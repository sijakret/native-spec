import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findSpecsDirectory } from "./utils/spec-viewer/src/project.js";

describe("spec viewer project discovery", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "native-spec-viewer-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const projectAt = (directory: string): string => {
    mkdirSync(join(directory, "definition"), { recursive: true });
    writeFileSync(join(directory, "definition", "project.ts"), "");
    return directory;
  };
  const artifactAt = (directory: string): string =>
    join(directory, "artifacts", "requirements", "001-search.sr.ts");

  it("finds a conventional workspace's specs folder", () => {
    const specs = projectAt(join(root, "specs"));
    expect(findSpecsDirectory(root, artifactAt(specs), "specs")).toBe(specs);
  });

  it("works when the specs directory is the workspace", () => {
    const specs = projectAt(root);
    expect(findSpecsDirectory(root, artifactAt(specs), "specs")).toBe(specs);
  });

  it("finds an example nested below the repository workspace", () => {
    const specs = projectAt(
      join(root, "skills", "native-spec", "examples", "typescript", "specs"),
    );
    expect(findSpecsDirectory(root, artifactAt(specs), "specs")).toBe(specs);
  });

  it("selects the owning project rather than another workspace project", () => {
    projectAt(join(root, "specs"));
    const specs = projectAt(join(root, "packages", "notes", "specs"));
    expect(findSpecsDirectory(root, artifactAt(specs), "specs")).toBe(specs);
  });

  it("prefers the nearest enclosing project", () => {
    projectAt(root);
    const specs = projectAt(join(root, "examples", "notes", "specs"));
    expect(findSpecsDirectory(root, artifactAt(specs), "specs")).toBe(specs);
  });

  it("uses the configured folder when no ancestor defines a project", () => {
    const specs = projectAt(join(root, "docs", "process"));
    expect(
      findSpecsDirectory(root, artifactAt(root), join("docs", "process")),
    ).toBe(specs);
  });

  it("does not search above the workspace", () => {
    projectAt(root);
    const workspace = join(root, "app");
    expect(() =>
      findSpecsDirectory(workspace, artifactAt(workspace), "specs"),
    ).toThrow("No spec project found");
  });

  it("reports missing projects with an actionable setting name", () => {
    expect(() =>
      findSpecsDirectory(root, artifactAt(root), "specs"),
    ).toThrow("Check the nativeSpec.specsFolder setting.");
  });

  it("rejects documents outside the workspace", () => {
    projectAt(root);
    expect(() =>
      findSpecsDirectory(root, artifactAt(`${root}-other`), "specs"),
    ).toThrow("Open the artifact inside its workspace.");
  });
});

describe("spec viewer rendering", () => {
  it("renders saved, unsaved, and index documents using the project's toolchain", () => {
    const specs = import.meta.dirname;
    const file = join(
      specs,
      "artifacts",
      "requirements",
      "001-full-text-search.sr.ts",
    );
    const source = readFileSync(file, "utf8");
    const index = join(specs, "artifacts", "index.ts");
    const project = findSpecsDirectory(dirname(specs), file, "specs");
    const require = createRequire(join(project, "package.json"));
    const requests = [
      { id: 0, path: file, source },
      {
        id: 1,
        path: file,
        source: source.replace('"Full-Text Search"', '"Unsaved search title"'),
      },
      { id: 2, path: file, source: "export const notAnArtifact = 1;" },
      { id: 3, path: index, source: readFileSync(index, "utf8") },
    ];
    const result = spawnSync(
      process.execPath,
      [require.resolve("tsx/cli"), join(specs, "utils/spec-viewer/src/render.ts"), project],
      {
        cwd: project,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        input: requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const responses = result.stdout
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as {
            id: number;
            html?: string;
            locations?: Record<string, string>;
            error?: string;
          },
      );
    expect(responses.map((response) => response.id)).toEqual([0, 1, 2, 3]);
    expect(responses[0]?.html).toContain('<article id="req-sr-001">');
    expect(responses[0]?.locations?.["req-sr-001"]).toBe(file);
    expect(responses[1]?.html).toContain("Unsaved search title");
    expect(responses[2]?.error).toContain("No artifact export found");
    expect(responses[3]?.html).toContain('<article id="req-mr-001">');
  });
});
