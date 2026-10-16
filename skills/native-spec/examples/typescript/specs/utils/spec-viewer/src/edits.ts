// Maps a rendered field path (e.g. ["tasks", 2, "done"]) to a minimal text edit in the artifact source.
import type * as TS from "typescript";

export type PathSegment = string | number;

export interface SourceEdit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export function editArtifactSource(
  ts: typeof TS,
  source: string,
  path: readonly PathSegment[],
  value: string | boolean,
): SourceEdit {
  const file = ts.createSourceFile(
    "artifact.ts",
    source,
    ts.ScriptTarget.ESNext,
    true,
  );
  const root = findArtifactLiteral(ts, file);
  if (!root) throw new Error("No artifact.<kind>({ ... }) call found.");

  let node: TS.Expression = root;
  for (const segment of path) {
    node = unwrap(ts, node);
    if (typeof segment === "number") {
      if (!ts.isArrayLiteralExpression(node))
        throw new Error(`Expected array at ${segment}`);
      const element = node.elements[segment];
      if (!element) throw new Error(`No element ${segment}`);
      node = element;
      continue;
    }
    if (ts.isCallExpression(node)) {
      // completedTask("text") stands for { text, done: true }.
      if (segment === "text") node = node.arguments[0]!;
      else if (segment !== "done")
        throw new Error(`Cannot address ${segment} on helper call`);
      continue;
    }
    if (!ts.isObjectLiteralExpression(node))
      throw new Error(`Expected object at ${segment}`);
    const property = node.properties.find(
      (candidate): candidate is TS.PropertyAssignment =>
        ts.isPropertyAssignment(candidate) &&
        candidate.name.getText(file) === segment,
    );
    if (!property) throw new Error(`No property ${segment}`);
    node = property.initializer;
  }

  node = unwrap(ts, node);
  if (typeof value === "string") {
    if (!ts.isStringLiteralLike(node))
      throw new Error("Field is not a string literal.");
    return {
      start: node.getStart(file),
      end: node.getEnd(),
      text: JSON.stringify(value),
    };
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return {
      start: node.getStart(file),
      end: node.getEnd(),
      text: String(value),
    };
  }
  if (ts.isCallExpression(node) && !value) {
    const text = node.arguments[0]?.getText(file) ?? '""';
    return {
      start: node.getStart(file),
      end: node.getEnd(),
      text: `{ text: ${text}, done: false }`,
    };
  }
  throw new Error("Field cannot be toggled.");
}

function findArtifactLiteral(
  ts: typeof TS,
  file: TS.SourceFile,
): TS.ObjectLiteralExpression | undefined {
  let found: TS.ObjectLiteralExpression | undefined;
  const visit = (node: TS.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "artifact"
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isObjectLiteralExpression(argument)) {
        found = argument;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function unwrap(ts: typeof TS, node: TS.Expression): TS.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}
