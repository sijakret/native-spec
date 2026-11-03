// Long-lived worker run under tsx by the extension host.
// Usage: render.ts <specsFolder>. Reads JSON lines { id, path, source } from stdin,
// writes { id, html, locations } or { id, error }.
// Rendering from text instead of disk lets unsaved edits and git diff sides work.
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

// Types come from the co-located spec project; the runtime modules are loaded from the configured folder.
type ProcessDefinition = typeof import("../../../definition/process.js");
type Project = {
  readonly default: import("../../../definition/process.js").SpecProject;
};
type Html = typeof import("../../output/html.js");
type Rendering = typeof import("../../output/rendering.js");
type Artifact = import("../../../definition/process.js").Artifact;
type ArchitectureAudit = typeof import("../../../audit/architecture-audit.js");
type CodeAudit = typeof import("../../../audit/code-audit.js");

interface Request {
  readonly id: number;
  readonly path: string;
  readonly source: string;
}

const [specsFolder] = process.argv.slice(2);
if (!specsFolder) throw new Error("Usage: render.ts <specsFolder>");
const specs = resolve(specsFolder);
const load = <Module>(relative: string): Promise<Module> =>
  import(pathToFileURL(join(specs, relative)).href);
// The installed extension lives outside the repo, so resolve typescript from the spec project.
const ts = createRequire(join(specs, "package.json"))(
  "typescript",
) as typeof import("typescript");

const { buildGraph, validateProject } = await load<ProcessDefinition>(
  "definition/process.ts",
);
const { default: project } = await load<Project>("definition/project.ts");
const { renderSpecPanel } = await load<Html>("utils/output/html.ts");
const { artifactAnchors } = await load<Rendering>("utils/output/rendering.ts");
const { validateArchitectureFigures } = await load<ArchitectureAudit>(
  "audit/architecture-audit.ts",
);
const { readTraceLinks } = await load<CodeAudit>("audit/code-audit.ts");

const artifactsDir = join(specs, "artifacts");
const architectureFile = join(
  artifactsDir,
  "architecture",
  "000-architecture.ts",
);
const artifactFilename = /\.(?:abb|mr|sr|nfr|tc|risk|sprint)\.ts$/;

const graph = buildGraph(project);
const locations: Record<string, string> = {
  "spec-overview": join(artifactsDir, "index.ts"),
  "spec-architecture": architectureFile,
};
for (const entry of await readdir(artifactsDir, { recursive: true })) {
  if (!artifactFilename.test(entry)) continue;
  const file = join(artifactsDir, entry);
  const module: Record<string, unknown> = await import(
    pathToFileURL(file).href
  );
  for (const value of Object.values(module)) {
    if (isArtifact(value))
      for (const anchor of artifactAnchors(value)) locations[anchor] = file;
  }
}

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const request = JSON.parse(line) as Request;
  try {
    const html = await render(request.source, resolve(request.path));
    process.stdout.write(
      `${JSON.stringify({ id: request.id, html, locations })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  }
}

async function render(source: string, path: string): Promise<string> {
  const module = await importSource(source, path);
  if (path === architectureFile) {
    if (!isOverview(module.architectureOverview))
      throw new Error(`No architectureOverview export found in ${path}`);
    const preview = { ...project, overview: module.architectureOverview };
    const problems = [
      ...validateProject(preview),
      ...validateArchitectureFigures(preview),
    ];
    if (problems.length) throw new Error(problems.join("\n"));
    return renderSpecPanel(graph, preview, undefined, "architecture");
  }
  const exported = Object.values(module).filter(isArtifact);
  const overview = path === join(artifactsDir, "index.ts");
  if (exported.length === 0 && !(overview && project.artifacts.length === 0)) {
    throw new Error(`No artifact export found in ${path}`);
  }
  const inventory = exported.some(
    (artifact) =>
      artifact.kind === "architecture-block" ||
      "acceptanceCriteria" in artifact,
  )
    ? readTraceLinks(specs, project, new Map([[path, source]]))
    : undefined;
  return renderSpecPanel(
    graph,
    project,
    overview ? undefined : exported,
    "overview",
    inventory?.code,
    inventory?.tests,
  );
}

async function importSource(
  text: string,
  path: string,
): Promise<Record<string, unknown>> {
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  });
  const base = pathToFileURL(path);
  // The module runs from a data: URL; keep sidecar lookups relative to the real file.
  const absolute = outputText
    .replaceAll("import.meta.url", JSON.stringify(base.href))
    .replace(
      /(from\s+|import\s*\(?\s*)(["'])(\.\.?\/[^"']+)\2/g,
      (_match, prefix: string, quote: string, specifier: string) =>
        `${prefix}${quote}${new URL(specifier, base).href}${quote}`,
    );
  return import(
    `data:text/javascript;base64,${Buffer.from(absolute).toString("base64")}`
  );
}

function isArtifact(value: unknown): value is Artifact {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "id" in value &&
    "title" in value
  );
}

function isOverview(
  value: unknown,
): value is NonNullable<Project["default"]["overview"]> {
  return (
    typeof value === "object" &&
    value !== null &&
    "description" in value &&
    typeof value.description === "string"
  );
}
