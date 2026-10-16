import {
  artifactKey,
  buildGraph,
  type Artifact,
  type CodeBlock,
  type Requirement,
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

export interface HtmlRenderOptions {
  readonly language?: string;
  readonly stylesheets?: readonly string[];
}

type SpecGraph = ReturnType<typeof buildGraph>;

export function renderHtml(
  project: SpecProject,
  options: HtmlRenderOptions = {},
): string {
  const graph = buildGraph(project);
  const renderedSections = sections.flatMap((section) => {
    const artifacts = project.artifacts.filter(
      (artifact) => artifact.kind === section.kind,
    );
    return artifacts.length === 0 ? [] : [{ ...section, artifacts }];
  });
  const stylesheets = (options.stylesheets ?? [])
    .map(
      (href) => `    <link rel="stylesheet" href="${escapeAttribute(href)}">`,
    )
    .join("\n");

  const lines = [
    "<!doctype html>",
    `<html lang="${escapeAttribute(options.language ?? "en")}">`,
    "  <head>",
    '    <meta charset="utf-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    `    <title>${escapeHtml(project.title)}</title>`,
    stylesheets,
    "  </head>",
    "  <body>",
    "    <header>",
    `      <h1>${escapeHtml(project.title)}</h1>`,
  ];

  if (project.overview) {
    lines.push(`      <p>${escapeHtml(project.overview.description)}</p>`);
    renderCodeBlocks(lines, project.overview.diagrams, 6);
  }

  lines.push(
    "    </header>",
    '    <nav aria-label="Contents">',
    "      <h2>Contents</h2>",
    "      <ul>",
  );
  for (const section of renderedSections) {
    lines.push(
      `        <li><a href="#${sectionAnchor(section.kind)}">${escapeHtml(section.title)}</a>`,
      "          <ul>",
    );
    for (const artifact of section.artifacts) {
      lines.push(
        `            <li><a href="#${artifactAnchor(artifact)}">${artifactLabel(artifact)}</a></li>`,
      );
    }
    lines.push("          </ul>", "        </li>");
  }
  lines.push("      </ul>", "    </nav>", "    <main>");

  for (const section of renderedSections) {
    lines.push(
      `      <section id="${sectionAnchor(section.kind)}">`,
      `        <h2>${escapeHtml(section.title)}</h2>`,
    );
    for (const artifact of section.artifacts) {
      renderArtifactArticle(lines, graph, artifact, 8);
    }
    lines.push("      </section>");
  }

  lines.push("    </main>", "  </body>", "</html>");
  return `${lines.filter(Boolean).join("\n")}\n`;
}

export function renderArtifactFragment(
  graph: SpecGraph,
  artifacts: readonly Artifact[],
  project?: SpecProject,
): string {
  const lines: string[] = [];
  if (project) renderProjectOverview(lines, project);
  if (artifacts.length > 1) {
    lines.push('<nav aria-label="Contents">', "  <ul>");
    for (const section of sections) {
      const members = artifacts.filter((a) => a.kind === section.kind);
      if (members.length === 0) continue;
      lines.push(`    <li>${escapeHtml(section.title)}`, "      <ul>");
      for (const artifact of members)
        lines.push(`        <li>${artifactLink(artifact)}</li>`);
      lines.push("      </ul>", "    </li>");
    }
    lines.push("  </ul>", "</nav>");
  }
  for (const artifact of artifacts) {
    renderArtifactArticle(lines, graph, artifact, 0);
  }
  return `${lines.join("\n")}\n`;
}

export function renderSpecPanel(
  graph: SpecGraph,
  project: SpecProject,
  artifacts?: readonly Artifact[],
): string {
  const current = artifacts?.length === 1 ? artifacts[0] : undefined;
  const overview = artifacts === undefined;
  const lines = [
    '<div class="spec-panel">',
    '  <a class="skip-link" href="#spec-content">Skip to content</a>',
    '  <header class="spec-toolbar">',
    '    <nav class="spec-breadcrumbs" aria-label="Breadcrumb">',
    `      <a href="#spec-overview" title="Open overview">${escapeHtml(project.title)}</a>`,
    '      <span class="breadcrumb-separator" aria-hidden="true">/</span>',
    `      <span aria-current="page">${escapeHtml(current?.id ?? (overview ? "Overview" : "Artifacts"))}</span>`,
    "    </nav>",
    '    <span class="spec-toolbar-label">Specification</span>',
    "  </header>",
    '  <main id="spec-content" class="spec-content" tabindex="-1">',
    '    <div class="spec-document">',
  ];
  if (overview) {
    const groups = sections.flatMap((section) => {
      const members = project.artifacts.filter(
        (artifact) => artifact.kind === section.kind,
      );
      return members.length ? [{ ...section, artifacts: members }] : [];
    });
    renderProjectOverview(lines, project, false);
    lines.push(
      '<section class="spec-catalog" aria-labelledby="spec-catalog-title">',
      '  <h2 id="spec-catalog-title">Browse specification</h2>',
      '  <div class="spec-catalog-groups">',
    );
    for (const group of groups) {
      lines.push(
        "    <section>",
        `      <h3>${escapeHtml(group.title)} <span class="count-badge">${group.artifacts.length}</span></h3>`,
        "      <ul>",
      );
      for (const artifact of group.artifacts)
        lines.push(`        <li>${artifactLink(artifact)}</li>`);
      lines.push("      </ul>", "    </section>");
    }
    if (groups.length === 0) {
      lines.push(
        '    <p class="empty-state">No artifacts yet. Add artifacts to the project to see them here.</p>',
      );
    }
    lines.push("  </div>", "</section>");
  } else {
    for (const artifact of artifacts)
      renderArtifactArticle(lines, graph, artifact, 0);
  }
  lines.push("    </div>", "  </main>", "</div>");
  return `${lines.join("\n")}\n`;
}

function renderProjectOverview(
  lines: string[],
  project: SpecProject,
  includeBreakdown = true,
): void {
  const requirements = project.artifacts.filter(
    (artifact): artifact is Requirement => "acceptanceCriteria" in artifact,
  );
  const criteria = requirements.reduce(
    (count, requirement) => count + requirement.acceptanceCriteria.length,
    0,
  );
  lines.push(
    '<header class="spec-overview">',
    `  <h1>${escapeHtml(project.title)}</h1>`,
  );
  if (project.overview) {
    lines.push(`  <p>${escapeHtml(project.overview.description)}</p>`);
  }
  lines.push(
    '  <dl class="spec-metrics">',
    `    <div><dt>Artifacts</dt><dd>${project.artifacts.length}</dd></div>`,
    `    <div><dt>Requirements</dt><dd>${requirements.length}</dd></div>`,
    `    <div><dt>Acceptance criteria</dt><dd>${criteria}</dd></div>`,
    `    <div><dt>Relations</dt><dd>${project.relations.length}</dd></div>`,
    "  </dl>",
  );
  if (!includeBreakdown) {
    renderCodeBlocks(lines, project.overview?.diagrams, 2);
    lines.push("</header>");
    return;
  }
  lines.push(
    '  <div class="spec-breakdown">',
    "    <section><h2>Artifact types</h2><ul>",
  );
  for (const section of sections) {
    const members = project.artifacts.filter(
      (artifact) => artifact.kind === section.kind,
    );
    if (!members.length) continue;
    lines.push(
      `      <li><a href="#${artifactAnchor(members[0])}">${escapeHtml(section.title)}</a><strong>${members.length}</strong></li>`,
    );
  }
  lines.push(
    "    </ul></section>",
    "    <section><h2>Requirement size</h2><ul>",
  );
  for (const requirement of requirements) {
    lines.push(
      `      <li><a href="#${artifactAnchor(requirement)}">${artifactLabel(requirement)}</a><strong>${requirement.acceptanceCriteria.length} criteria</strong></li>`,
    );
  }
  lines.push("    </ul></section>", "  </div>", "</header>");
}

function renderArtifactArticle(
  lines: string[],
  graph: SpecGraph,
  artifact: Artifact,
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  lines.push(
    `${spaces}<article id="${artifactAnchor(artifact)}">`,
    `${spaces}  <h3>${escapeHtml(artifact.id)} - <span data-path="title">${escapeHtml(artifact.title)}</span></h3>`,
  );
  renderArtifact(lines, artifact, indentation + 2);

  const key = artifactKey(artifact);
  const relationGroups = groupRelations(
    graph.outgoing.get(key) ?? [],
    graph.incoming.get(key) ?? [],
    graph.artifacts,
  );
  if (relationGroups.length > 0) {
    lines.push(`${spaces}  <h4>Relations</h4>`, `${spaces}  <ul>`);
    for (const group of relationGroups) {
      lines.push(
        `${spaces}    <li><strong>${escapeHtml(group.label)}:</strong> ${group.artifacts.map(artifactLink).join(", ")}</li>`,
      );
    }
    lines.push(`${spaces}  </ul>`);
  }
  lines.push(`${spaces}</article>`);
}

function renderArtifact(
  lines: string[],
  artifact: Artifact,
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  for (const bound of boundFields(artifact)) {
    switch (bound.kind) {
      case "paragraph":
        lines.push(
          `${spaces}<p data-path="${bound.key}">${escapeHtml(bound.value)}</p>`,
        );
        break;
      case "inline": {
        const value =
          typeof bound.value === "string"
            ? `<span data-path="${bound.key}">${escapeHtml(bound.value)}</span>`
            : escapeHtml(bound.value.join(", "));
        lines.push(
          `${spaces}<p><strong>${escapeHtml(bound.label)}:</strong> ${value}</p>`,
        );
        break;
      }
      case "list":
        renderList(
          lines,
          bound.label,
          bound.key,
          bound.value,
          indentation,
          bound.ordered ?? false,
        );
        break;
      case "code":
        renderCodeBlocks(lines, bound.value, indentation);
        break;
      case "tasks":
        renderTasks(lines, bound.label, bound.key, bound.value, indentation);
        break;
    }
  }
}

function artifactLink(artifact: Artifact): string {
  return `<a href="#${artifactAnchor(artifact)}">${artifactLabel(artifact)}</a>`;
}

function artifactLabel(artifact: Artifact): string {
  return `${escapeHtml(artifact.id)} - ${escapeHtml(artifact.title)}`;
}

function renderList(
  lines: string[],
  title: string,
  key: string,
  values: readonly string[],
  indentation: number,
  ordered = false,
): void {
  const spaces = " ".repeat(indentation);
  const tag = ordered ? "ol" : "ul";
  lines.push(`${spaces}<h4>${escapeHtml(title)}</h4>`, `${spaces}<${tag}>`);
  values.forEach((value, index) =>
    lines.push(
      `${spaces}  <li data-path="${key}.${index}">${escapeHtml(value)}</li>`,
    ),
  );
  lines.push(`${spaces}</${tag}>`);
}

function renderCodeBlocks(
  lines: string[],
  blocks: readonly CodeBlock[] | undefined,
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  for (const block of blocks ?? []) {
    lines.push(
      `${spaces}<pre><code class="language-${escapeAttribute(block.language)}">${escapeHtml(block.source)}</code></pre>`,
    );
  }
}

function renderTasks(
  lines: string[],
  title: string,
  key: string,
  tasks: readonly Task[],
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  lines.push(`${spaces}<h4>${escapeHtml(title)}</h4>`, `${spaces}<ul>`);
  tasks.forEach((task, index) =>
    renderTask(lines, task, `${key}.${index}`, indentation + 2),
  );
  lines.push(`${spaces}</ul>`);
}

function renderTask(
  lines: string[],
  task: Task,
  path: string,
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  const checked = task.done ? " checked" : "";
  lines.push(
    `${spaces}<li><label><input type="checkbox" data-path="${path}.done"${checked} disabled> <span data-path="${path}.text">${escapeHtml(task.text)}</span></label>`,
  );
  if (task.children?.length) {
    lines.push(`${spaces}  <ul>`);
    task.children.forEach((child, index) =>
      renderTask(lines, child, `${path}.children.${index}`, indentation + 4),
    );
    lines.push(`${spaces}  </ul>`);
  }
  lines.push(`${spaces}</li>`);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
