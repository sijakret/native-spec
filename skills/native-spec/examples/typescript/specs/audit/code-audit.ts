import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseCss } from "postcss";
import ts from "typescript";
import {
  artifactKey,
  buildGraph,
  type ArchitectureBlock,
  type SpecProject,
} from "../definition/process.js";

interface SpecAnnotation {
  readonly tag: "spec" | "specModule";
  readonly targets: readonly string[];
  readonly pos: number;
  readonly end: number;
}

function typescriptComments(ast: ts.SourceFile): readonly ts.CommentRange[] {
  const comments = new Map<number, ts.CommentRange>();
  const jsxText: { pos: number; end: number }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      jsxText.push(node);
      return;
    }
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    )
      return;
    for (const comment of [
      ...(ts.getLeadingCommentRanges(ast.text, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(ast.text, node.pos) ?? []),
    ])
      comments.set(comment.pos, comment);
    for (const child of node.getChildren(ast)) visit(child);
  };
  visit(ast);
  return [...comments.values()]
    .filter(
      (comment) =>
        !jsxText.some(
          (text) => comment.pos >= text.pos && comment.pos < text.end,
        ),
    )
    .sort((left, right) => left.pos - right.pos);
}

function callableAnnotationHosts(node: ts.Node): readonly ts.Node[] {
  const hosts = [node];
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return hosts;
  let declaration = node.parent;
  while (
    ts.isParenthesizedExpression(declaration) ||
    ts.isAsExpression(declaration) ||
    ts.isSatisfiesExpression(declaration)
  ) {
    hosts.push(declaration);
    declaration = declaration.parent;
  }
  if (
    ts.isPropertyAssignment(declaration) ||
    ts.isPropertyDeclaration(declaration)
  ) {
    hosts.push(declaration);
  } else if (ts.isVariableDeclaration(declaration)) {
    hosts.push(declaration);
    const list = declaration.parent;
    if (
      ts.isVariableDeclarationList(list) &&
      ts.isVariableStatement(list.parent)
    ) {
      hosts.push(list, list.parent);
    }
  }
  return hosts;
}

interface CodeTrace {
  readonly architectureBlocks: readonly string[];
  readonly directRequirements: readonly string[];
  readonly requirements: readonly string[];
}

export interface CodeEntry extends CodeTrace {
  readonly file: string;
  readonly symbol: string;
  readonly kind: "module" | "function" | "callback";
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly inheritedFrom?: string;
}

export function readAppSources(root: string): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  const visit = (directory: string): void => {
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(`App-source symlinks are not supported: ${path}`);
      if (entry.isDirectory()) visit(path);
      else files.set(path, readFileSync(join(root, path), "utf8"));
    }
  };
  visit("src");
  return files;
}

export function auditSources(
  files: ReadonlyMap<string, string>,
  project: SpecProject,
) {
  const errors: string[] = [];
  const inventory: CodeEntry[] = [];
  const targets = new Set<string>();
  const graph = buildGraph(project);
  const artifacts = new Map(
    project.artifacts
      .filter((artifact) => artifact.project === project.id)
      .map((artifact) => [artifact.id as string, artifact]),
  );
  const architectureBlocks = new Map<string, ArchitectureBlock>(
    project.artifacts
      .filter(
        (artifact): artifact is ArchitectureBlock =>
          artifact.kind === "architecture-block" &&
          artifact.project === project.id,
      )
      .map((artifact) => [artifact.id, artifact]),
  );
  const implementedRequirements = new Map<string, readonly string[]>();
  for (const architecture of architectureBlocks.values()) {
    const implemented: string[] = [];
    for (const relation of graph.outgoing.get(artifactKey(architecture)) ??
      []) {
      if (relation.kind !== "implements") continue;
      const requirement = graph.artifacts.get(artifactKey(relation.to));
      if (
        !requirement ||
        !("acceptanceCriteria" in requirement) ||
        requirement.project !== project.id ||
        relation.to.project !== project.id ||
        relation.from.project !== project.id
      ) {
        errors.push(
          `Invalid implementation relation: ${architecture.id} -> ${relation.to.id}`,
        );
      } else {
        implemented.push(requirement.id);
      }
    }
    implementedRequirements.set(architecture.id, [...new Set(implemented)]);
  }
  const moduleOwners = new Map<string, readonly string[]>();
  for (const [file, source] of files) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const isTypescript = /\.(?:[cm]?[jt]sx?)$/.test(file);
    let comments: readonly Pick<ts.CommentRange, "pos" | "end">[] = [];
    let headerEnd = ast.statements[0]?.getStart(ast) ?? source.length;
    if (isTypescript) {
      comments = typescriptComments(ast);
    } else if (file.endsWith(".css")) {
      try {
        const css = parseCss(source, { from: file });
        const ranges: { pos: number; end: number }[] = [];
        css.walkComments((comment) => {
          ranges.push({
            pos: comment.source!.start!.offset,
            end: comment.source!.end!.offset,
          });
        });
        comments = ranges;
        headerEnd =
          css.nodes.find((node) => node.type !== "comment")?.source?.start
            ?.offset ?? source.length;
      } catch (error) {
        errors.push(
          `Invalid CSS source in ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      errors.push(`Unsupported app source file: ${file}`);
    }
    const annotations: SpecAnnotation[] = [];
    for (const comment of comments) {
      const text = source.slice(
        comment.pos + 2,
        source.startsWith("//", comment.pos) ? comment.end : comment.end - 2,
      );
      for (const match of text.matchAll(
        /(?:^|\r?\n)[ \t]*\*?[ \t]*@(specModule|spec)\b([^\r\n]*)/g,
      )) {
        const ids = match[2]!
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean);
        if (ids.length === 0)
          errors.push(
            `Empty @${match[1]} annotation: ${file}:${ast.getLineAndCharacterOfPosition(comment.pos).line + 1}`,
          );
        annotations.push({
          tag: match[1] as SpecAnnotation["tag"],
          targets: ids,
          pos: comment.pos,
          end: comment.end,
        });
      }
    }
    const consumed = new Map<SpecAnnotation, string>();
    const links = new Map<string, CodeTrace>();
    const annotatedTrace = (
      target: string,
      selected: readonly SpecAnnotation[],
    ): CodeTrace => {
      for (const annotation of selected) {
        const previous = consumed.get(annotation);
        if (previous && previous !== target)
          errors.push(
            `Annotation applies to multiple code targets: ${previous}, ${target}`,
          );
        consumed.set(annotation, target);
      }
      const ids = selected.flatMap((annotation) => annotation.targets);
      const owners: string[] = [];
      const direct: string[] = [];
      const derived: string[] = [];
      for (const id of ids) {
        const artifact = artifacts.get(id);
        if (artifact?.kind === "architecture-block") {
          owners.push(id);
          const implemented = implementedRequirements.get(id) ?? [];
          if (implemented.length === 0)
            errors.push(
              `Architecture block has no implementation requirements: ${id}`,
            );
          derived.push(...implemented);
        } else if (artifact && "acceptanceCriteria" in artifact) {
          direct.push(id);
        } else {
          errors.push(
            `Unknown or unsupported spec target ${id} linked from ${target}`,
          );
        }
      }
      if (new Set(ids).size !== ids.length)
        errors.push(`Duplicate spec link: ${target}`);
      return {
        architectureBlocks: [...new Set(owners)],
        directRequirements: [...new Set(direct)],
        requirements: [...new Set([...derived, ...direct])],
      };
    };
    const moduleAnnotations = annotations.filter(
      (annotation) => annotation.tag === "specModule",
    );
    for (const annotation of moduleAnnotations) {
      if (annotation.pos >= headerEnd)
        errors.push(
          `Module annotation must be in file header: ${file}:${ast.getLineAndCharacterOfPosition(annotation.pos).line + 1}`,
        );
    }
    const add = (
      symbol: string,
      kind: CodeEntry["kind"],
      node: ts.Node,
      inheritedFrom?: string,
    ): string => {
      const target = `${file}#${symbol}`;
      const owner = inheritedFrom ?? target;
      if (targets.has(target)) errors.push(`Duplicate code target: ${target}`);
      targets.add(target);
      const hosts = callableAnnotationHosts(node);
      const selected =
        kind === "module"
          ? moduleAnnotations
          : annotations.filter(
              (annotation) =>
                kind === "function" &&
                annotation.tag === "spec" &&
                hosts.some(
                  (host) =>
                    annotation.pos >= host.getFullStart() &&
                    annotation.end <= host.getStart(ast),
                ),
            );
      const linked = inheritedFrom
        ? (links.get(owner) ?? {
            architectureBlocks: [],
            directRequirements: [],
            requirements: [],
          })
        : annotatedTrace(target, selected);
      links.set(target, linked);
      if (linked.architectureBlocks.length === 0)
        errors.push(`Missing architecture link: ${target}`);
      if (kind === "module") {
        moduleOwners.set(file, linked.architectureBlocks);
      }
      for (const id of linked.architectureBlocks) {
        const declared = architectureBlocks.get(id)?.files;
        if (declared && !declared.includes(file))
          errors.push(
            `Architecture block ${id} does not list annotated file: ${file}`,
          );
      }
      const start = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      const end = ast.getLineAndCharacterOfPosition(node.getEnd());
      inventory.push({
        file,
        symbol,
        kind,
        line: start.line + 1,
        column: start.character + 1,
        endLine: end.line + 1,
        ...linked,
        ...(inheritedFrom ? { inheritedFrom } : {}),
      });
      return target;
    };
    const module = add("<module>", "module", ast);
    const qualified = (scope: string, name: string): string =>
      scope ? `${scope}.${name}` : name;
    const nameOf = (
      name: ts.PropertyName | ts.BindingName | undefined,
    ): string | undefined => {
      if (!name) return undefined;
      if (
        ts.isIdentifier(name) ||
        ts.isPrivateIdentifier(name) ||
        ts.isStringLiteral(name) ||
        ts.isNumericLiteral(name)
      )
        return name.text;
      if (
        ts.isComputedPropertyName(name) &&
        (ts.isStringLiteral(name.expression) ||
          ts.isNumericLiteral(name.expression))
      )
        return name.expression.text;
      errors.push(
        `Unsupported dynamic callable/container name in ${file}:${ast.getLineAndCharacterOfPosition(name.pos).line + 1}`,
      );
      return undefined;
    };
    const assignedName = (node: ts.Node): string | undefined => {
      let parent = node.parent;
      while (
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent)
      )
        parent = parent.parent;
      if (
        ts.isVariableDeclaration(parent) ||
        ts.isPropertyAssignment(parent) ||
        ts.isPropertyDeclaration(parent)
      )
        return nameOf(parent.name);
      if (
        !ts.isObjectLiteralExpression(node) &&
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        errors.push(
          `Assign callables to a declared variable or property in ${file}.`,
        );
      }
      return undefined;
    };
    const visit = (node: ts.Node, scope: string, owner: string): void => {
      let nextScope = scope;
      let nextOwner = owner;
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const name = nameOf(node.name) ?? assignedName(node);
        if (!name)
          errors.push(`Anonymous classes need a stable name in ${file}.`);
        else nextScope = qualified(scope, name);
      } else if (ts.isObjectLiteralExpression(node)) {
        const name = assignedName(node);
        if (name) nextScope = qualified(scope, name);
      } else if (ts.isModuleDeclaration(node)) {
        nextScope = qualified(scope, node.name.text);
      }
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isConstructorDeclaration(node) ||
          ts.isGetAccessorDeclaration(node) ||
          ts.isSetAccessorDeclaration(node)) &&
        node.body
      ) {
        let name: string | undefined;
        if (ts.isConstructorDeclaration(node)) name = "constructor";
        else if (ts.isGetAccessorDeclaration(node))
          name = `get:${nameOf(node.name)}`;
        else if (ts.isSetAccessorDeclaration(node))
          name = `set:${nameOf(node.name)}`;
        else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
          name =
            assignedName(node) ??
            (ts.isFunctionExpression(node) ? nameOf(node.name) : undefined);
        else name = nameOf(node.name);
        if (name) {
          nextScope = qualified(scope, name);
          nextOwner = add(nextScope, "function", node);
        } else {
          const position = ast.getLineAndCharacterOfPosition(
            node.getStart(ast),
          );
          add(
            qualified(
              scope,
              `<callback@${position.line + 1}:${position.character + 1}>`,
            ),
            "callback",
            node,
            owner,
          );
        }
      }
      ts.forEachChild(node, (child) => visit(child, nextScope, nextOwner));
    };
    if (isTypescript) visit(ast, "", module);
    for (const annotation of annotations) {
      if (!consumed.has(annotation))
        errors.push(
          `Unattached @${annotation.tag} annotation: ${file}:${ast.getLineAndCharacterOfPosition(annotation.pos).line + 1}`,
        );
    }
  }
  for (const architecture of architectureBlocks.values()) {
    for (const file of architecture.files ?? []) {
      if (!file.startsWith("src/")) continue;
      if (!files.has(file)) {
        errors.push(`Missing architecture file: ${architecture.id}:${file}`);
      } else if (!moduleOwners.get(file)?.includes(architecture.id)) {
        errors.push(
          `Architecture file ownership mismatch: ${architecture.id}:${file}`,
        );
      }
    }
  }
  if (files.size === 0) errors.push("No app source files found.");
  return { inventory, errors };
}
