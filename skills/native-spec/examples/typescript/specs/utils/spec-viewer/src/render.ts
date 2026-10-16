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
type Engine = typeof import("../../../definition/engine.js");
type Project = typeof import("../../../definition/project.js");
type Html = typeof import("../../output/html.js");
type Rendering = typeof import("../../output/rendering.js");
type Artifact = import("../../../definition/engine.js").Artifact;

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

const { buildGraph } = await load<Engine>("definition/engine.ts");
const { default: project } = await load<Project>("definition/project.ts");
const { renderArtifactFragment } = await load<Html>("utils/output/html.ts");
const { artifactAnchor } = await load<Rendering>("utils/output/rendering.ts");

const artifactsDir = join(specs, "artifacts");
const artifactFilename = /\.(?:abb|mr|sr|nfr|tc|risk|sprint)\.ts$/;

const graph = buildGraph(project);
const locations: Record<string, string> = {};
for (const entry of await readdir(artifactsDir, { recursive: true })) {
  if (!artifactFilename.test(entry)) continue;
  const file = join(artifactsDir, entry);
  const module: Record<string, unknown> = await import(
    pathToFileURL(file).href
  );
  for (const value of Object.values(module)) {
    if (isArtifact(value)) locations[artifactAnchor(value)] = file;
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
  const exported = Object.values(await importSource(source, path)).filter(
    isArtifact,
  );
  if (exported.length === 0) {
    throw new Error(`No artifact export found in ${path}`);
  }
  return renderArtifactFragment(
    graph,
    exported,
    path === join(artifactsDir, "index.ts") ? project : undefined,
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
  const absolute = outputText.replace(
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
