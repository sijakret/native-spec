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
