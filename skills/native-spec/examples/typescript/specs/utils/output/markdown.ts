import {
  artifactKey,
  buildGraph,
  figureToken,
  isFigure,
  type Artifact,
  type Diagram,
  type SpecProject,
  type Task,
} from "../../definition/process.js";
import {
  artifactAnchor,
  criterionAnchor,
  criterionTests,
  groupRelations,
  sectionAnchor,
  sections,
} from "./rendering.js";
import { boundFields } from "./views.js";

export interface MarkdownRenderOptions {
  // Maps an Excalidraw sidecar URL to the image link written into the document.
  readonly figureHref?: (url: string) => string;
}

export function renderMarkdown(
  project: SpecProject,
  options: MarkdownRenderOptions = {},
): string {
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
    if (project.overview.intendedUses?.length) {
      lines.push(
        "## Intended uses",
        "",
        ...project.overview.intendedUses.map((use) => `- ${use}`),
        "",
      );
    }
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
      renderArtifact(lines, artifact, graph);

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
            `- **${group.label}:** ${group.targets
              .map(({ artifact: target, criterion }) =>
                criterion === undefined
                  ? artifactLink(target)
                  : `[${artifactLabel(target)} / ${escapeMarkdown(criterion)}](#${criterionAnchor(target, criterion)})`,
              )
              .join(", ")}`,
          );
        }
        lines.push("");
      }
    }
  }

  const markdown = `${lines.join("\n").trim()}\n`;
  const { figureHref } = options;
  // Figure tokens are already Markdown links/images; only their targets may need remapping.
  return figureHref
    ? markdown.replace(
        figureToken,
        (_match, bang: string, title: string, url: string) =>
          `${bang}[${title}](<${figureHref(url)}>)`,
      )
    : markdown;
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

function renderArtifact(
  lines: string[],
  artifact: Artifact,
  graph: ReturnType<typeof buildGraph>,
): void {
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
      case "criteria":
        lines.push(`**${bound.label}:**`, "");
        for (const criterion of bound.value) {
          const tests = criterionTests(graph, artifact, criterion.id);
          lines.push(
            `<a id="${criterionAnchor(artifact, criterion.id)}"></a>`,
            "",
            `- **${escapeMarkdown(criterion.id)}:** ${criterion.description}${tests.length ? ` (Tested by: ${tests.map(artifactLink).join(", ")})` : ""}`,
            "",
          );
        }
        break;
      case "code":
        renderCodeBlocks(lines, bound.value);
        break;
      case "diagram":
        renderCodeBlocks(lines, [bound.value]);
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

function renderCodeBlocks(lines: string[], blocks?: readonly Diagram[]): void {
  for (const block of blocks ?? []) {
    lines.push(`**${escapeMarkdown(block.title)}**`, "");
    if (isFigure(block)) {
      lines.push(
        `![${escapeMarkdown(block.title)}](<${block.excalidraw}>)`,
        "",
      );
      continue;
    }
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
