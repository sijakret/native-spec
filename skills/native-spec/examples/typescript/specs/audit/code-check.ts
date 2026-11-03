import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import project from "../definition/project.js";
import { validateProject } from "../definition/process.js";
import { auditSources, readAppSources } from "./code-audit.js";
import { validateArchitectureFigures } from "./architecture-audit.js";

const root = resolve(import.meta.dirname, "../..");
const artifacts = resolve(import.meta.dirname, "../artifacts");
const artifactSources = new Map(
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
const result = auditSources(readAppSources(root), project, artifactSources);
const errors = [
  ...validateProject(project),
  ...validateArchitectureFigures(project),
  ...result.errors,
];
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result.inventory, null, 2)}\n`);
} else {
  const modules = result.inventory.filter(
    (entry) => entry.kind === "module",
  ).length;
  const named = result.inventory.filter(
    (entry) => entry.kind === "function",
  ).length;
  const inherited = result.inventory.filter(
    (entry) => entry.kind === "callback",
  ).length;
  console.log(
    `Code links OK: ${modules} files, ${named} ABB-owned named callables, ${inherited} inherited callbacks.`,
  );
}
