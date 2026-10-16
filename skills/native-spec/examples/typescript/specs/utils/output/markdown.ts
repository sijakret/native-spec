import {
  artifactKey,
  buildGraph,
  type Artifact,
  type CodeBlock,
  type SpecProject,
  type Task,
} from "../../definition/engine.js";
import {
  artifactAnchor,
  groupRelations,
  sectionAnchor,
  sections,
} from "./rendering.js";
import { boundFields } from "./views.js";

export function renderMarkdown(project: SpecProject): string {
  const graph = buildGraph(project);
  const lines = [`# ${project.title}`, ""];
  const renderedSections = sections.flatMap((section) => {
    const artifacts = project.artifacts.filter(
      (artifact) => artifact.kind === section.kind,
    );
    return artifacts.length === 0 ? [] : [{ ...section, artifacts }];
  });

  if (project.overview) {
    lines.push(project.overview.description, "");
    renderCodeBlocks(lines, project.overview.diagrams);
  }

  lines.push("## Contents", "");
  for (const section of renderedSections) {
    lines.push(`- [${section.title}](#${sectionAnchor(section.kind)})`);
    for (const artifact of section.artifacts) {
      lines.push(`  - ${artifactLink(artifact)}`);
    }
  }
  lines.push("");

  for (const section of renderedSections) {
    lines.push(
      `<a id="${sectionAnchor(section.kind)}"></a>`,
      "",
      `## ${section.title}`,
      "",
    );

    for (const artifact of section.artifacts) {
      lines.push(
        `<a id="${artifactAnchor(artifact)}"></a>`,
        "",
        `### ${artifact.id} - ${artifact.title}`,
        "",
      );
      renderArtifact(lines, artifact);

      const key = artifactKey(artifact);
      const outgoing = graph.outgoing.get(key) ?? [];
      const incoming = graph.incoming.get(key) ?? [];
      const relationGroups = groupRelations(
        outgoing,
        incoming,
        graph.artifacts,
      );
      if (relationGroups.length > 0) {
        lines.push("**Relations:**", "");
        for (const group of relationGroups) {
          lines.push(
            `- **${group.label}:** ${group.artifacts.map(artifactLink).join(", ")}`,
          );
        }
        lines.push("");
      }
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function artifactLink(artifact: Artifact): string {
  return `[${artifactLabel(artifact)}](#${artifactAnchor(artifact)})`;
}

function artifactLabel(artifact: Artifact): string {
  return `${escapeMarkdown(artifact.id)} - ${escapeMarkdown(artifact.title)}`;
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function renderArtifact(lines: string[], artifact: Artifact): void {
  for (const bound of boundFields(artifact)) {
    switch (bound.kind) {
      case "paragraph":
        lines.push(bound.value, "");
        break;
      case "inline":
        lines.push(
          `**${bound.label}:** ${typeof bound.value === "string" ? bound.value : bound.value.join(", ")}`,
          "",
        );
        break;
      case "list":
        renderList(lines, bound.label, bound.value, bound.ordered ?? false);
        break;
      case "code":
        renderCodeBlocks(lines, bound.value);
        break;
      case "tasks":
        renderTasks(lines, bound.label, bound.value);
        break;
    }
  }
}

function renderList(
  lines: string[],
  title: string,
  values: readonly string[],
  ordered = false,
): void {
  lines.push(`**${title}:**`, "");
  values.forEach((value, index) =>
    lines.push(`${ordered ? `${index + 1}.` : "-"} ${value}`),
  );
  lines.push("");
}

function renderCodeBlocks(
  lines: string[],
  blocks?: readonly CodeBlock[],
): void {
  for (const block of blocks ?? []) {
    lines.push(`\`\`\`${block.language}`, block.source, "```", "");
  }
}

function renderTasks(
  lines: string[],
  title: string,
  tasks: readonly Task[],
): void {
  lines.push(`**${title}:**`, "");
  for (const task of tasks) renderTask(lines, task, 0);
  lines.push("");
}

function renderTask(lines: string[], task: Task, depth: number): void {
  lines.push(`${"  ".repeat(depth)}- [${task.done ? "x" : " "}] ${task.text}`);
  for (const child of task.children ?? []) renderTask(lines, child, depth + 1);
}
