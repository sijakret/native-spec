import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  artifactFactory,
  artifactKey,
  buildGraph,
  validateProject,
  type ArtifactKind,
} from "./definition/engine.js";
import project from "./definition/project.js";
import { renderHtml } from "./utils/output/html.js";
import { renderMarkdown } from "./utils/output/markdown.js";

const suffixes = {
  "market-requirement": "mr",
  "software-requirement": "sr",
  "non-functional-requirement": "nfr",
  "architecture-block": "abb",
  "test-case": "tc",
  risk: "risk",
  sprint: "sprint",
} as const satisfies Record<ArtifactKind, string>;

describe("native spec", () => {
  it("forms a valid closed graph", () => {
    expect(validateProject(project)).toEqual([]);
  });

  it("names each artifact file <ID number>-<slug>.<kind>.ts", () => {
    const files = readdirSync(join(import.meta.dirname, "artifacts"), {
      recursive: true,
      encoding: "utf8",
    }).map((file) => file.split(/[\\/]/).at(-1)!);

    for (const artifact of project.artifacts) {
      const number = artifact.id.split("-").at(-1)!;
      const pattern = new RegExp(
        `^${number}-[a-z0-9]+(?:-[a-z0-9]+)*\\.${suffixes[artifact.kind]}\\.ts$`,
      );
      expect(files.filter((file) => pattern.test(file))).toHaveLength(1);
    }
  });

  it("derives incoming relations from canonical outgoing ones", () => {
    const graph = buildGraph(project);
    const key = artifactKey({ kind: "software-requirement", id: "REQ-SR-001" });
    expect(graph.outgoing.get(key)?.map((relation) => relation.kind)).toEqual([
      "derives-from",
    ]);
    expect(graph.incoming.get(key)?.map((relation) => relation.kind)).toEqual([
      "implements",
      "verifies",
      "delivers",
    ]);
  });

  it("rejects completed sprints with open tasks", () => {
    const sprint = artifactFactory("gate").sprint({
      id: "SPRINT-0001",
      title: "Gate",
      status: "completed",
      description: "Open review task",
      tasks: [{ text: "Implement", done: true }],
      architectureReview: [{ text: "Update ABB-001", done: false }],
      documentationIntegrity: [{ text: "Record results", done: true }],
    });
    expect(
      validateProject({
        id: "gate",
        title: "Gate",
        artifacts: [sprint],
        relations: [],
      }),
    ).toEqual(["Completed sprint has open tasks: sprint:SPRINT-0001"]);
  });

  it("renders Markdown and HTML from the graph", () => {
    expect(renderMarkdown(project)).toContain(
      "- **Tested by:** [TC-001 - Note Store Suite](#tc-001)",
    );
    expect(renderHtml(project)).toContain('<article id="req-sr-001">');
  });
});
