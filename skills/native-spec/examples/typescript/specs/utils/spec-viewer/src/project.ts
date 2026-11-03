import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export function findSpecsDirectory(
  workspaceRoot: string,
  documentPath: string,
  configuredFolder: string,
): string {
  const root = resolve(workspaceRoot);
  let directory = dirname(resolve(documentPath));
  const relativeDirectory = relative(root, directory);
  if (
    relativeDirectory === ".." ||
    relativeDirectory.startsWith(`..${sep}`) ||
    isAbsolute(relativeDirectory)
  ) {
    throw new Error("Open the artifact inside its workspace.");
  }

  const marker = join("definition", "project.ts");
  while (true) {
    if (existsSync(join(directory, marker))) return directory;
    if (directory === root) break;
    directory = dirname(directory);
  }

  const configured = resolve(root, configuredFolder);
  if (existsSync(join(configured, marker))) return configured;
  throw new Error(
    `No spec project found for ${documentPath}: expected an ancestor containing ${marker} or ${join(configured, marker)}. Check the nativeSpec.specsFolder setting.`,
  );
}

export function codeSourceLocation(
  specs: string,
  file: string,
  line = 1,
  column = 1,
): { readonly file: string; readonly line: number; readonly column: number } {
  const root = resolve(specs, "..");
  const target = resolve(root, file);
  const local = relative(root, target);
  if (
    !local ||
    isAbsolute(file) ||
    local === ".." ||
    local.startsWith(`..${sep}`)
  )
    throw new Error("Code links must stay inside the spec project.");
  if (
    !Number.isSafeInteger(line) ||
    line < 1 ||
    !Number.isSafeInteger(column) ||
    column < 1
  )
    throw new Error("Code links require positive line and column numbers.");
  return { file: target, line: line - 1, column: column - 1 };
}
