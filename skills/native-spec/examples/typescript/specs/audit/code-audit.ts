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

export interface TestEntry extends Pick<
  CodeEntry,
  "file" | "symbol" | "line" | "column" | "endLine"
> {
  readonly kind: "test" | "suite";
  readonly verifications: readonly {
    readonly requirement: string;
    readonly criterion: string;
  }[];
}

export interface TraceLinks {
  readonly code: readonly CodeEntry[];
  readonly tests: readonly TestEntry[];
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
  auditOptions: { readonly includeExternalTargets?: boolean } = {},
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

  const inventoryFiles = new Map(files);
  if (auditOptions.includeExternalTargets) {
    for (const source of program.getSourceFiles()) {
      const file = pathOf(source);
      if (
        !source.isDeclarationFile &&
        !file.startsWith("../") &&
        !file.split("/").includes("node_modules")
      )
        inventoryFiles.set(file, source.text);
    }
  }
  for (const [file] of inventoryFiles) {
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
  const resolveSymbol = (
    symbol: ts.Symbol | undefined,
    node: ts.TypeNode,
    targetName = node.getText(),
  ): readonly string[] => {
    const symbolDeclarations = symbol?.getDeclarations() ?? [];
    const targetType =
      symbol &&
      !symbolDeclarations.some((declaration) => nodeTargets.has(declaration))
        ? checker.getTypeOfSymbolAtLocation(symbol, node)
        : undefined;
    const declarations = [
      ...symbolDeclarations,
      ...(targetType?.getSymbol()?.getDeclarations() ?? []),
      ...[
        ...(targetType?.getCallSignatures() ?? []),
        ...(targetType?.getConstructSignatures() ?? []),
      ].flatMap((signature) => {
        const declaration = signature.getDeclaration();
        return declaration ? [declaration] : [];
      }),
    ];
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
      `Unresolved implementation target: ${pathOf(node.getSourceFile())}:${targetName}`,
    );
    return [];
  };
  const resolveTarget = (node: ts.TypeNode): readonly string[] => {
    if (ts.isTypeReferenceNode(node)) {
      const group = checker.getTypeFromTypeNode(node);
      const members = group.getProperties();
      if (
        !(group.flags & ts.TypeFlags.Object) ||
        (group.getSymbol()?.flags ?? 0) & ts.SymbolFlags.Class ||
        !members.length ||
        group.getCallSignatures().length ||
        group.getConstructSignatures().length ||
        checker.getIndexInfosOfType(group).length
      ) {
        errors.push(
          `Invalid implementation group: ${pathOf(node.getSourceFile())}:${node.getText()}`,
        );
        return [];
      }
      return members.flatMap((member) =>
        resolveSymbol(
          member,
          node,
          `${node.getText()}[${JSON.stringify(member.getName())}]`,
        ),
      );
    }
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
    return resolveSymbol(symbol, node);
  };
  const isProcessType = (node: ts.Node, name: string): boolean =>
    symbolAt(node)
      ?.getDeclarations()
      ?.some(
        (declaration) =>
          ts.isTypeAliasDeclaration(declaration) &&
          declaration.name.text === name &&
          declaration
            .getSourceFile()
            .fileName.replaceAll("\\", "/")
            .endsWith("/definition/process.ts"),
      ) ?? false;
  const registeredTests = new Map<
    ts.Node,
    {
      readonly location: Omit<TestEntry, "verifications">;
      readonly verifications: { requirement: string; criterion: string }[];
      readonly calls: {
        readonly node: ts.CallExpression;
        readonly enabled: boolean;
      }[];
    }
  >();
  const isTestRegistration = (
    expression: ts.Expression,
    names = ["it", "test"],
    includeSkipped = false,
  ): boolean => {
    if (ts.isCallExpression(expression))
      return isTestRegistration(expression.expression, names, includeSkipped);
    if (ts.isPropertyAccessExpression(expression)) {
      if (
        ["each", "for", "only", "concurrent", "sequential", "fails"].includes(
          expression.name.text,
        ) ||
        (includeSkipped &&
          ["skip", "todo", "skipIf", "runIf"].includes(expression.name.text))
      )
        return isTestRegistration(expression.expression, names, includeSkipped);
      if (!names.includes(expression.name.text)) return false;
      return (
        checker
          .getSymbolAtLocation(expression.expression)
          ?.getDeclarations()
          ?.some(
            (declaration) =>
              ts.isNamespaceImport(declaration) &&
              !declaration.parent.isTypeOnly &&
              ts.isImportDeclaration(declaration.parent.parent) &&
              ts.isStringLiteral(declaration.parent.parent.moduleSpecifier) &&
              declaration.parent.parent.moduleSpecifier.text === "vitest",
          ) ?? false
      );
    }
    return (
      checker
        .getSymbolAtLocation(expression)
        ?.getDeclarations()
        ?.some(
          (declaration) =>
            ts.isImportSpecifier(declaration) &&
            !declaration.isTypeOnly &&
            !declaration.parent.parent.isTypeOnly &&
            names.includes(
              (declaration.propertyName ?? declaration.name).text,
            ) &&
            ts.isImportDeclaration(declaration.parent.parent.parent) &&
            ts.isStringLiteral(
              declaration.parent.parent.parent.moduleSpecifier,
            ) &&
            declaration.parent.parent.parent.moduleSpecifier.text === "vitest",
        ) ?? false
    );
  };
  for (const source of program.getSourceFiles()) {
    const file = pathOf(source);
    if (
      file.startsWith("../") ||
      file.split("/").includes("node_modules") ||
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
    )
      continue;
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        isTestRegistration(
          node.expression,
          ["it", "test", "describe", "suite"],
          true,
        )
      ) {
        const kind = isTestRegistration(
          node.expression,
          ["describe", "suite"],
          true,
        )
          ? "suite"
          : "test";
        const call = {
          node,
          enabled: isTestRegistration(
            node.expression,
            kind === "suite" ? ["describe", "suite"] : ["it", "test"],
          ),
        };
        for (const argument of node.arguments.slice(1)) {
          for (const signature of checker
            .getTypeAtLocation(argument)
            .getCallSignatures()) {
            const declaration = signature.getDeclaration();
            if (
              !declaration ||
              !(
                ts.isFunctionDeclaration(declaration) ||
                ts.isFunctionExpression(declaration) ||
                ts.isArrowFunction(declaration) ||
                ts.isMethodDeclaration(declaration)
              ) ||
              !declaration.body
            )
              continue;
            const existing = registeredTests.get(declaration);
            if (existing) {
              existing.calls.push(call);
              continue;
            }
            const ast = declaration.getSourceFile();
            const start = ast.getLineAndCharacterOfPosition(
              declaration.getStart(ast),
            );
            const end = ast.getLineAndCharacterOfPosition(declaration.getEnd());
            const name =
              declaration.name?.getText(ast) ??
              (ts.isVariableDeclaration(declaration.parent)
                ? declaration.parent.name.getText(ast)
                : `<test@${start.line + 1}:${start.character + 1}>`);
            registeredTests.set(declaration, {
              location: {
                kind,
                file: pathOf(ast),
                symbol: name,
                line: start.line + 1,
                column: start.character + 1,
                endLine: end.line + 1,
              },
              verifications: [],
              calls: [call],
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const enclosingSuites = (node: ts.Node): ts.Node[] => {
    const suites: ts.Node[] = [];
    for (let parent = node.parent; parent; parent = parent.parent)
      if (registeredTests.get(parent)?.location.kind === "suite")
        suites.push(parent);
    return suites;
  };
  const enabled = new Set<ts.Node>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [declaration, entry] of registeredTests)
      if (
        !enabled.has(declaration) &&
        entry.calls.some(
          (call) =>
            call.enabled &&
            enclosingSuites(call.node).every((suite) => enabled.has(suite)),
        )
      ) {
        enabled.add(declaration);
        changed = true;
      }
  }
  const hasExecutableTests = (
    declaration: ts.Node,
    ancestors = new Set<ts.Node>(),
  ): boolean => {
    if (!enabled.has(declaration) || ancestors.has(declaration)) return false;
    if (registeredTests.get(declaration)?.location.kind === "test") return true;
    const visited = new Set([...ancestors, declaration]);
    return [...registeredTests].some(
      ([child, entry]) =>
        entry.calls.some(
          (call) =>
            call.enabled &&
            enclosingSuites(call.node).includes(declaration) &&
            enclosingSuites(call.node).every((suite) => enabled.has(suite)),
        ) && hasExecutableTests(child, visited),
    );
  };
  const executable = [...registeredTests.keys()].filter((declaration) =>
    hasExecutableTests(declaration),
  );
  for (const declaration of registeredTests.keys())
    if (!executable.includes(declaration)) registeredTests.delete(declaration);
  const linkCriterionTests = (node: ts.VariableDeclaration): void => {
    const ownerType = checker.getTypeAtLocation(node.name);
    const id = literalProperty(ownerType, "id", node);
    const projectId = literalProperty(ownerType, "project", node);
    const kind = literalProperty(ownerType, "kind", node);
    if (!id || projectId !== project.id || !kind?.endsWith("requirement"))
      return;
    const criteriaProperty = ownerType.getProperty("acceptanceCriteria");
    if (!criteriaProperty) return;
    const criteriaType = checker.getTypeOfSymbolAtLocation(
      criteriaProperty,
      node,
    );
    const inlineCriteria = criteriaType
      .getProperties()
      .filter((property) => /^\d+$/.test(property.getName()))
      .map((property) => checker.getTypeOfSymbolAtLocation(property, node));
    const requirement = project.artifacts.find(
      (artifact) =>
        artifact.project === project.id &&
        artifact.id === id &&
        "acceptanceCriteria" in artifact,
    );
    if (!requirement || !("acceptanceCriteria" in requirement)) {
      errors.push(`Unknown verification owner: ${id}`);
      return;
    }
    const criteria = new Set(
      requirement.acceptanceCriteria.map((criterion) => criterion.id),
    );
    const linkedCriteria = new Set<string>();
    for (const criterionType of inlineCriteria) {
      const criterion = literalProperty(criterionType, "id", node);
      if (!criterion || !criteria.has(criterion)) {
        errors.push(`Unknown verification criterion: ${id}:${criterion}`);
        continue;
      }
      const references = criterionType.getProperty("tests");
      if (!references) continue;
      linkedCriteria.add(criterion);
      const referenceType = checker.getTypeOfSymbolAtLocation(references, node);
      const canonical = referenceType.aliasSymbol
        ?.getDeclarations()
        ?.some(
          (declaration) =>
            ts.isTypeAliasDeclaration(declaration) &&
            declaration.name.text === "TestReferences" &&
            declaration
              .getSourceFile()
              .fileName.replaceAll("\\", "/")
              .endsWith("/definition/process.ts"),
        );
      if (!canonical) {
        errors.push(
          `Criterion test links must use testedBy: ${id}:${criterion}`,
        );
        continue;
      }
      const tuple = referenceType.aliasTypeArguments?.[0];
      const targetTypes =
        tuple && checker.isTupleType(tuple)
          ? checker.getTypeArguments(tuple as ts.TypeReference)
          : [];
      if (targetTypes.length === 0) {
        errors.push(
          `Verification requires a nonempty test tuple: ${id}:${criterion}`,
        );
        continue;
      }
      const seen = new Set<ts.Node>();
      for (const target of targetTypes) {
        const declarations = [
          ...new Set(
            target.getCallSignatures().flatMap((signature) => {
              const declaration = signature.getDeclaration();
              return declaration && registeredTests.has(declaration)
                ? [declaration]
                : [];
            }),
          ),
        ];
        if (!declarations.length)
          errors.push(
            `Verification target is not a registered Vitest test or nonempty suite: ${id}:${criterion}`,
          );
        for (const declaration of declarations) {
          if (seen.has(declaration)) {
            errors.push(`Duplicate verification target: ${id}:${criterion}`);
            continue;
          }
          seen.add(declaration);
          const entry = registeredTests.get(declaration)!;
          if (
            !entry.verifications.some(
              (verification) =>
                verification.requirement === id &&
                verification.criterion === criterion,
            )
          )
            entry.verifications.push({
              requirement: requirement.id,
              criterion,
            });
        }
      }
    }
    for (const criterion of criteria) {
      if (!linkedCriteria.has(criterion))
        errors.push(
          `Missing acceptance criterion test link: ${id}:${criterion}`,
        );
    }
  };
  for (const file of sources.keys()) {
    const ast = program.getSourceFile(file)!;
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node)) linkCriterionTests(node);
      if (
        ts.isTypeReferenceNode(node) ||
        ts.isExpressionWithTypeArguments(node)
      ) {
        const name = ts.isTypeReferenceNode(node)
          ? node.typeName
          : node.expression;
        if (isProcessType(name, "Implementation")) {
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
            const targetNodes = [...implementations.elements];
            if (
              ts.isExpressionWithTypeArguments(node) &&
              ts.isHeritageClause(node.parent) &&
              ts.isInterfaceDeclaration(node.parent.parent)
            ) {
              const specBindings = node.parent.parent.members.find(
                (member): member is ts.PropertySignature =>
                  ts.isPropertySignature(member) &&
                  ts.isIdentifier(member.name) &&
                  member.name.text === "specBindings",
              )?.type;
              if (specBindings) {
                if (
                  ts.isTypeReferenceNode(specBindings) &&
                  isProcessType(specBindings.typeName, "Bindings") &&
                  specBindings.typeArguments?.length === 2
                ) {
                  targetNodes.push(specBindings.typeArguments[1]!);
                } else {
                  errors.push(
                    `Interface specBindings must use Bindings<Contract, Source>: ${pathOf(ast)}`,
                  );
                }
              }
            }
            const seen = new Set<string>();
            for (const target of targetNodes.flatMap(resolveTarget)) {
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
  const tests: TestEntry[] = [...registeredTests.values()]
    .filter((entry) => entry.verifications.length > 0)
    .map((entry) => ({
      ...entry.location,
      verifications: entry.verifications,
    }));
  return { inventory, tests, errors };
}

export function readTraceLinks(
  specs: string,
  project: SpecProject,
  overrides: ReadonlyMap<string, string> = new Map(),
): TraceLinks {
  const root = resolve(specs, "..");
  const artifacts = join(specs, "artifacts");
  const sources = new Map(
    readdirSync(artifacts, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".ts"))
      .map(
        (file) =>
          [
            relative(root, join(artifacts, file)).replaceAll("\\", "/"),
            readFileSync(join(artifacts, file), "utf8"),
          ] as const,
      ),
  );
  for (const [file, text] of overrides)
    sources.set(relative(root, file).replaceAll("\\", "/"), text);
  const result = auditSources(readAppSources(root), project, sources, root, {
    includeExternalTargets: true,
  });
  return {
    code: result.inventory.filter(
      (entry) => entry.architectureBlocks.length > 0,
    ),
    tests: result.tests,
  };
}

export function readCodeLinks(
  specs: string,
  project: SpecProject,
  overrides: ReadonlyMap<string, string> = new Map(),
): readonly CodeEntry[] {
  return readTraceLinks(specs, project, overrides).code;
}
