import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import {
  artifactKey,
  buildGraph,
  type ArchitectureBlock,
  type SpecProject,
} from "../definition/process.js";

interface CodeTrace {
  readonly architectureBlocks: readonly string[];
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
      const file = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(`App-source symlinks are not supported: ${file}`);
      if (entry.isDirectory()) visit(file);
      else files.set(file, readFileSync(join(root, file), "utf8"));
    }
  };
  visit("src");
  return files;
}

export function auditSources(
  files: ReadonlyMap<string, string>,
  project: SpecProject,
  linkSources: ReadonlyMap<string, string>,
  root = resolve(import.meta.dirname, "../.."),
) {
  const errors: string[] = [];
  const sources = new Map(
    [...files, ...linkSources]
      .filter(([file]) => /\.[cm]?[jt]sx?$/.test(file))
      .map(([file, source]) => [resolve(root, file), source]),
  );
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const originalSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (file) =>
    sources.has(resolve(file)) || originalFileExists(file);
  host.getSourceFile = (file, languageVersion, onError, fresh) => {
    const text = sources.get(resolve(file));
    return text === undefined
      ? originalSourceFile(file, languageVersion, onError, fresh)
      : ts.createSourceFile(file, text, languageVersion, true);
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  const checker = program.getTypeChecker();
  const pathOf = (file: ts.SourceFile): string =>
    relative(root, file.fileName).replaceAll("\\", "/");
  const unlinked: Omit<CodeEntry, keyof CodeTrace>[] = [];
  const nodeTargets = new Map<ts.Node, string>();
  const targets = new Set<string>();
  const linked = new Map<string, Set<string>>();
  const graph = buildGraph(project);
  const blocks = new Map<string, ArchitectureBlock>(
    project.artifacts
      .filter(
        (artifact): artifact is ArchitectureBlock =>
          artifact.kind === "architecture-block" &&
          artifact.project === project.id,
      )
      .map((artifact) => [artifact.id, artifact]),
  );
  const requirements = new Map<string, string[]>();
  for (const block of blocks.values()) {
    const implemented: string[] = [];
    for (const relation of graph.outgoing.get(artifactKey(block)) ?? []) {
      if (relation.kind !== "implements") continue;
      const requirement = graph.artifacts.get(artifactKey(relation.to));
      if (
        !requirement ||
        !("acceptanceCriteria" in requirement) ||
        requirement.project !== project.id ||
        relation.to.project !== project.id
      ) {
        errors.push(
          `Invalid implementation relation: ${block.id} -> ${relation.to.id}`,
        );
      } else implemented.push(requirement.id);
    }
    requirements.set(block.id, [...new Set(implemented)]);
  }

  for (const [file] of files) {
    const ast = program.getSourceFile(resolve(root, file));
    if (!ast && !file.endsWith(".css")) {
      errors.push(`Unsupported app source file: ${file}`);
      continue;
    }
    const add = (
      symbol: string,
      kind: CodeEntry["kind"],
      node?: ts.Node,
      inheritedFrom?: string,
    ): string => {
      const target = `${file}#${symbol}`;
      if (targets.has(target)) errors.push(`Duplicate code target: ${target}`);
      targets.add(target);
      if (node) nodeTargets.set(node, target);
      const start =
        node && ast?.getLineAndCharacterOfPosition(node.getStart(ast));
      const end = node && ast?.getLineAndCharacterOfPosition(node.getEnd());
      unlinked.push({
        file,
        symbol,
        kind,
        line: (start?.line ?? 0) + 1,
        column: (start?.character ?? 0) + 1,
        endLine: (end?.line ?? 0) + 1,
        ...(inheritedFrom ? { inheritedFrom } : {}),
      });
      return target;
    };
    const module = add("<module>", "module", ast);
    if (!ast) continue;
    const qualified = (scope: string, name: string): string =>
      scope ? `${scope}.${name}` : name;
    const nameOf = (
      name: ts.PropertyName | ts.BindingName | undefined,
    ): string | undefined => {
      if (!name) return;
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
      errors.push(`Unsupported dynamic callable/container name in ${file}.`);
      return;
    };
    const assigned = (node: ts.Node): ts.Node => {
      let parent = node.parent;
      while (
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent)
      )
        parent = parent.parent;
      return parent;
    };
    const assignedName = (node: ts.Node): string | undefined => {
      const parent = assigned(node);
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
      )
        errors.push(
          `Assign callables to a declared variable or property in ${file}.`,
        );
      return;
    };
    const visit = (node: ts.Node, scope: string, owner: string): void => {
      let nextScope = scope;
      let nextOwner = owner;
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const name = nameOf(node.name) ?? assignedName(node);
        if (name) nextScope = qualified(scope, name);
        else errors.push(`Anonymous classes need a stable name in ${file}.`);
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
          if (ts.isConstructorDeclaration(node))
            nodeTargets.set(node.parent, nextOwner);
          if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
            nodeTargets.set(assigned(node), nextOwner);
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
    visit(ast, "", module);
  }

  const symbolAt = (node: ts.Node): ts.Symbol | undefined => {
    const symbol = checker.getSymbolAtLocation(node);
    return symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  };
  const literalProperty = (
    type: ts.Type,
    name: string,
    node: ts.Node,
  ): string | undefined => {
    const property = checker.getPropertyOfType(type, name);
    if (!property) return;
    const value = checker.getTypeOfSymbolAtLocation(property, node);
    return value.isStringLiteral() ? value.value : undefined;
  };
  const resolveTarget = (node: ts.TypeNode): readonly string[] => {
    let symbol: ts.Symbol | undefined;
    if (ts.isTypeQueryNode(node)) symbol = symbolAt(node.exprName);
    else if (ts.isImportTypeNode(node) && node.isTypeOf)
      symbol = checker.getTypeFromTypeNode(node).getSymbol();
    else if (ts.isIndexedAccessTypeNode(node)) {
      const key = checker.getTypeFromTypeNode(node.indexType);
      if (key.isStringLiteral() || key.isNumberLiteral())
        symbol = checker.getPropertyOfType(
          checker.getTypeFromTypeNode(node.objectType),
          String(key.value),
        );
    }
    const declarations = symbol?.getDeclarations() ?? [];
    const resolved = [
      ...new Set(
        declarations.flatMap((declaration) => {
          const target = nodeTargets.get(declaration);
          return target ? [target] : [];
        }),
      ),
    ];
    if (resolved.length) return resolved;
    if (
      declarations.length &&
      declarations.every(
        (declaration) =>
          !pathOf(declaration.getSourceFile()).startsWith("src/"),
      )
    )
      return [];
    errors.push(
      `Unresolved implementation target: ${pathOf(node.getSourceFile())}:${node.getText()}`,
    );
    return [];
  };
  for (const file of sources.keys()) {
    const ast = program.getSourceFile(file)!;
    const visit = (node: ts.Node): void => {
      if (ts.isTypeReferenceNode(node)) {
        const marker = symbolAt(node.typeName);
        const declaration = marker
          ?.getDeclarations()
          ?.find(
            (candidate) =>
              ts.isTypeAliasDeclaration(candidate) &&
              candidate.name.text === "Implementation" &&
              candidate
                .getSourceFile()
                .fileName.replaceAll("\\", "/")
                .endsWith("/definition/process.ts"),
          );
        if (declaration) {
          const [owner, implementations] = node.typeArguments ?? [];
          if (
            !owner ||
            !implementations ||
            !ts.isTupleTypeNode(implementations)
          ) {
            errors.push(
              `Implementation requires an owner and a tuple of source symbols: ${pathOf(ast)}`,
            );
          } else {
            const type = checker.getTypeFromTypeNode(owner);
            const ownerTypes = type.isUnion() ? type.types : [type];
            const owners = ownerTypes.flatMap((candidate) => {
              const id = literalProperty(candidate, "id", owner);
              const projectId = literalProperty(candidate, "project", owner);
              const kind = literalProperty(candidate, "kind", owner);
              if (
                !id ||
                kind !== "architecture-block" ||
                projectId !== project.id ||
                !blocks.has(id)
              ) {
                errors.push(
                  `Unknown implementation owner: ${owner.getText()} in ${pathOf(ast)}`,
                );
                return [];
              }
              if (!requirements.get(id)?.length)
                errors.push(
                  `Architecture block has no implementation requirements: ${id}`,
                );
              return [id];
            });
            const seen = new Set<string>();
            for (const target of implementations.elements.flatMap(
              resolveTarget,
            )) {
              if (seen.has(target))
                errors.push(`Duplicate implementation target: ${target}`);
              seen.add(target);
              const owned = linked.get(target) ?? new Set<string>();
              for (const id of owners) owned.add(id);
              linked.set(target, owned);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  for (const block of blocks.values()) {
    for (const file of block.files ?? []) {
      if (!file.startsWith("src/")) continue;
      if (!files.has(file))
        errors.push(`Missing architecture file: ${block.id}:${file}`);
      else if (!file.endsWith(".css") && !file.endsWith(".d.ts"))
        errors.push(
          `Use an Implementation symbol link for TypeScript file: ${file}`,
        );
      else {
        const target = `${file}#<module>`;
        const owned = linked.get(target) ?? new Set<string>();
        owned.add(block.id);
        linked.set(target, owned);
      }
    }
  }
  const inventory: CodeEntry[] = unlinked.map((entry) => {
    const target = `${entry.file}#${entry.symbol}`;
    const owned = entry.inheritedFrom
      ? linked.get(entry.inheritedFrom)
      : linked.get(target);
    const architectureBlocks = [...(owned ?? [])];
    if (!architectureBlocks.length)
      errors.push(`Missing architecture link: ${target}`);
    return {
      ...entry,
      architectureBlocks,
      requirements: [
        ...new Set(
          architectureBlocks.flatMap((id) => requirements.get(id) ?? []),
        ),
      ],
    };
  });
  if (!files.size) errors.push("No app source files found.");
  return { inventory, errors };
}
