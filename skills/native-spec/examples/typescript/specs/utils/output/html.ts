import {
  artifactKey,
  buildGraph,
  figureParts,
  isFigure,
  type Artifact,
  type Diagram,
  type Requirement,
  type SpecProject,
  type Task,
} from "../../definition/process.js";
import {
  artifactAnchor,
  criterionAnchor,
  criterionTests,
  groupRelations,
  relationLabels,
  relationPeers,
  sectionAnchor,
  sections,
  type RelationGroup,
} from "./rendering.js";
import { boundFields } from "./views.js";
import { specIcon } from "./icons.js";
import type { CodeEntry, TestEntry } from "../../audit/code-audit.js";

export interface HtmlRenderOptions {
  readonly language?: string;
  readonly stylesheets?: readonly string[];
  readonly codeInventory?: readonly CodeEntry[];
  readonly testInventory?: readonly TestEntry[];
  // Maps an Excalidraw sidecar URL to the image href written into the document.
  readonly figureHref?: FigureHref;
}

export type FigureHref = (url: string) => string;

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
    lines.push(`      <p>${richText(project.overview.description)}</p>`);
    renderIntendedUses(lines, project.overview.intendedUses, 6);
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
      renderArtifactArticle(
        lines,
        graph,
        artifact,
        8,
        options.codeInventory,
        options.testInventory,
      );
    }
    lines.push("      </section>");
  }

  lines.push("    </main>", "  </body>", "</html>");
  return mapFigureHrefs(
    `${lines.filter(Boolean).join("\n")}\n`,
    options.figureHref,
  );
}

export function renderArtifactFragment(
  graph: SpecGraph,
  artifacts: readonly Artifact[],
  project?: SpecProject,
  codeInventory?: readonly CodeEntry[],
  testInventory?: readonly TestEntry[],
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
    renderArtifactArticle(
      lines,
      graph,
      artifact,
      0,
      codeInventory,
      testInventory,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderSpecPanel(
  graph: SpecGraph,
  project: SpecProject,
  artifacts?: readonly Artifact[],
  page: "overview" | "architecture" = "overview",
  codeInventory?: readonly CodeEntry[],
  testInventory?: readonly TestEntry[],
): string {
  const current = artifacts?.length === 1 ? artifacts[0] : undefined;
  const overview = artifacts === undefined;
  const architecture = overview && page === "architecture";
  const lines = [
    '<div class="spec-panel">',
    '  <a class="skip-link" href="#spec-content">Skip to content</a>',
    '  <header class="spec-toolbar">',
    '    <nav class="spec-breadcrumbs" aria-label="Breadcrumb">',
    `      <a class="spec-project-link" href="#spec-overview" title="Open overview">${specIcon("project")}<span>${escapeHtml(project.title)}</span></a>`,
    '      <span class="breadcrumb-separator" aria-hidden="true">/</span>',
    ...(current?.kind === "architecture-block"
      ? [
          '      <a href="#spec-architecture">Architecture</a>',
          '      <span class="breadcrumb-separator" aria-hidden="true">/</span>',
        ]
      : []),
    `      <span aria-current="page">${current ? specIcon(current.kind) : ""}${escapeHtml(current?.id ?? (architecture ? "Architecture" : overview ? "Overview" : "Artifacts"))}</span>`,
    "    </nav>",
    `    <button class="source-button" type="button" data-open-source aria-label="Open Source" title="Open this document in the text editor">${specIcon("source")}</button>`,
    "  </header>",
    '  <main id="spec-content" class="spec-content" tabindex="-1">',
    '    <div class="spec-document">',
  ];
  if (architecture) {
    renderArchitectureOverview(lines, project);
  } else if (overview) {
    const groups = sections.flatMap((section) => {
      const members = project.artifacts.filter(
        (artifact) => artifact.kind === section.kind,
      );
      return members.length ? [{ ...section, artifacts: members }] : [];
    });
    renderProjectOverview(lines, project, false);
    if (
      project.artifacts.some(
        (artifact) => artifact.kind === "architecture-block",
      )
    )
      lines.push(
        `<p><a class="artifact-link" href="#spec-architecture">${specIcon("architecture-block")}<span>Architecture</span></a></p>`,
      );
    lines.push(
      '<section class="spec-catalog" aria-labelledby="spec-catalog-title">',
      '  <h2 id="spec-catalog-title">Browse specification</h2>',
      '  <div class="spec-catalog-groups">',
    );
    for (const group of groups) {
      lines.push(
        "    <section>",
        `      <h3>${specIcon(group.kind)}<span>${escapeHtml(group.title)}</span> <span class="count-badge">${group.artifacts.length}</span></h3>`,
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
      renderArtifactArticle(
        lines,
        graph,
        artifact,
        0,
        codeInventory,
        testInventory,
      );
  }
  lines.push("    </div>", "  </main>", "</div>");
  return `${lines.join("\n")}\n`;
}

function renderArchitectureOverview(
  lines: string[],
  project: SpecProject,
): void {
  lines.push(
    '<article id="spec-architecture" class="spec-architecture">',
    `  <h1>${escapeHtml(project.title)} Architecture</h1>`,
  );
  if (project.overview)
    lines.push(
      `  <p class="architecture-intro">${richText(project.overview.description)}</p>`,
    );
  renderCodeBlocks(
    lines,
    project.overview?.diagrams,
    2,
    undefined,
    false,
    false,
    " architecture-overview-diagram",
  );
  lines.push(
    '  <section aria-labelledby="architecture-blocks-title">',
    '    <h2 id="architecture-blocks-title">Building Blocks</h2>',
    '    <ul class="architecture-blocks">',
  );
  for (const block of project.artifacts.filter(
    (artifact) => artifact.kind === "architecture-block",
  )) {
    lines.push(
      "      <li>",
      `        <div class="architecture-block-copy">${artifactLink(block)}`,
      `        <p>${richText(block.description)}</p>`,
      "        </div>",
    );
    renderCodeBlocks(
      lines,
      [block.summaryDiagram],
      8,
      undefined,
      false,
      false,
      " architecture-block-diagram",
    );
    lines.push("      </li>");
  }
  lines.push("    </ul>", "  </section>", "</article>");
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
    lines.push(`  <p>${richText(project.overview.description)}</p>`);
    renderIntendedUses(lines, project.overview.intendedUses, 2);
  }
  lines.push(
    '  <dl class="spec-metrics">',
    `    <div><dt>Artifacts</dt><dd>${project.artifacts.length}</dd></div>`,
    `    <div><dt>Requirements</dt><dd>${requirements.length}</dd></div>`,
    `    <div><dt>Acceptance criteria</dt><dd>${criteria}</dd></div>`,
    `    <div><dt>Relations</dt><dd>${project.relations.length}</dd></div>`,
    "  </dl>",
  );
  renderCodeBlocks(lines, project.overview?.diagrams, 2);
  if (!includeBreakdown) {
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

function renderIntendedUses(
  lines: string[],
  uses: readonly string[] | undefined,
  indentation: number,
): void {
  if (!uses?.length) return;
  const spaces = " ".repeat(indentation);
  lines.push(
    `${spaces}<section class="spec-intended-uses" aria-labelledby="spec-intended-uses-title">`,
    `${spaces}  <h2 id="spec-intended-uses-title">Intended uses</h2>`,
    `${spaces}  <ul>`,
    ...uses.map((use) => `${spaces}    <li>${richText(use)}</li>`),
    `${spaces}  </ul>`,
    `${spaces}</section>`,
  );
}

function renderArtifactArticle(
  lines: string[],
  graph: SpecGraph,
  artifact: Artifact,
  indentation: number,
  codeInventory?: readonly CodeEntry[],
  testInventory?: readonly TestEntry[],
): void {
  const spaces = " ".repeat(indentation);
  lines.push(
    `${spaces}<article id="${artifactAnchor(artifact)}">`,
    `${spaces}  <h3 class="artifact-heading">${specIcon(artifact.kind)}<span class="artifact-heading-text"><span data-source-path="id">${escapeHtml(artifact.id)}</span> - <span data-path="title">${escapeHtml(artifact.title)}</span></span></h3>`,
  );
  renderArtifact(lines, artifact, indentation + 2, testInventory);

  if (artifact.kind === "architecture-block" && codeInventory) {
    const entries = codeInventory.filter(
      (entry) =>
        entry.kind !== "callback" &&
        entry.architectureBlocks.includes(artifact.id),
    );
    renderListBox(
      lines,
      {
        heading: `${artifactAnchor(artifact)}-code-links`,
        title: "Code Links",
        className: "spec-code-links",
        headingLevel: 4,
        count: entries.length,
        rows: sourceFileRows(entries, (entry) =>
          entry.kind === "module" ? "Module" : entry.symbol,
        ),
      },
      indentation + 2,
    );
  }

  const key = artifactKey(artifact);
  const relationGroups = groupRelations(
    graph.outgoing.get(key) ?? [],
    graph.incoming.get(key) ?? [],
    graph.artifacts,
  );
  if (relationGroups.length > 0) {
    const heading = `${artifactAnchor(artifact)}-relations`;
    lines.push(
      `${spaces}  <section class="spec-relations" aria-labelledby="${heading}">`,
      `${spaces}    <h4 id="${heading}">Relations</h4>`,
      `${spaces}    <div class="relation-grid">`,
    );
    for (const [index, group] of relationGroups.entries()) {
      const groupHeading = `${heading}-${index}`;
      const rows = group.targets.map(({ artifact: related, criterion }) => ({
        related,
        criterion,
        peers:
          criterion === undefined
            ? renderRelationPeers(graph, artifact, related, group)
            : "",
      }));
      const hasPeers = rows.some((row) => row.peers);
      renderListBox(
        lines,
        {
          heading: groupHeading,
          title: group.label,
          className: "relation-card",
          contextLabel: hasPeers ? relationPeerLabel(group) : undefined,
          rows: rows.map(
            ({ related, criterion, peers }) =>
              `<li class="relation-item">${criterion === undefined ? artifactLink(related, true) : `<a class="artifact-link spec-list-content" href="#${criterionAnchor(related, criterion)}" data-source-anchor="${artifactAnchor(related)}">${specIcon(related.kind)}<span>${artifactLabel(related)} / ${escapeHtml(criterion)}</span></a>`}${peers}</li>`,
          ),
        },
        indentation + 6,
      );
    }
    lines.push(`${spaces}    </div>`, `${spaces}  </section>`);
  }
  lines.push(`${spaces}</article>`);
}

function groupByFile<Entry extends Pick<CodeEntry, "file">>(
  entries: readonly Entry[],
): Map<string, Entry[]> {
  const files = new Map<string, Entry[]>();
  for (const entry of entries) {
    const group = files.get(entry.file) ?? [];
    group.push(entry);
    files.set(entry.file, group);
  }
  return files;
}

function criterionTestList(
  criterion: string,
  tests: readonly TestEntry[],
): string {
  if (!tests.length) return "";
  const rows = [...groupByFile(tests)].map(
    ([file, entries]) =>
      `<li><span class="criterion-test-file">${escapeHtml(file)}</span><span class="criterion-test-names">${entries
        .map(
          (test) =>
            `<button type="button" class="test-chip" data-code-file="${escapeAttribute(test.file)}" data-code-line="${test.line}" data-code-column="${test.column}" title="${escapeAttribute(`Open ${test.kind} ${test.symbol} at ${test.file}:${test.line}`)}"><code>${escapeHtml(test.symbol)}</code>${test.kind === "suite" ? '<span class="test-kind">suite</span>' : ""}</button>`,
        )
        .join("")}</span></li>`,
  );
  return `<ul class="criterion-tests" aria-label="Tests for ${escapeAttribute(criterion)}">${rows.join("")}</ul>`;
}

function sourceFileRows<
  Entry extends Pick<CodeEntry, "file" | "symbol" | "line" | "column">,
>(entries: readonly Entry[], label: (entry: Entry) => string): string[] {
  return [...groupByFile(entries)].map(
    ([file, declarations]) =>
      `<li><details class="code-link-file"><summary><span class="code-link-file-heading"><code>${escapeHtml(file)}</code><span class="count-badge">${declarations.length}</span></span></summary><ul class="spec-list">${declarations.map((entry) => sourceLinkRow(entry, label(entry))).join("")}</ul></details></li>`,
  );
}

function sourceLinkRow(
  entry: Pick<CodeEntry, "file" | "symbol" | "line" | "column">,
  name: string,
): string {
  const location = `${entry.file}:${entry.line}`;
  return `<li><button type="button" class="code-link" data-code-file="${escapeAttribute(entry.file)}" data-code-line="${entry.line}" data-code-column="${entry.column}" title="${escapeAttribute(`Open ${name} at ${location}`)}"><span class="code-link-name">${specIcon("source")}<code>${escapeHtml(name)}</code></span><span class="code-link-location">Line ${entry.line}</span></button></li>`;
}

function renderListBox(
  lines: string[],
  options: {
    readonly heading: string;
    readonly title: string;
    readonly className: string;
    readonly rows: readonly string[];
    readonly count?: number;
    readonly headingLevel?: 4 | 5;
    readonly contextLabel?: string;
  },
  indentation: number,
): void {
  const spaces = " ".repeat(indentation);
  const tag = `h${options.headingLevel ?? 5}`;
  lines.push(
    `${spaces}<section class="spec-list-box ${options.className}"${options.contextLabel ? " data-peer-context" : ""} aria-labelledby="${options.heading}">`,
    `${spaces}  <header class="spec-list-header"><div class="spec-list-heading"><${tag} id="${options.heading}">${escapeHtml(options.title)}</${tag}><span class="count-badge">${options.count ?? options.rows.length}</span></div>${options.contextLabel ? `<span class="relation-context-heading" aria-hidden="true">${escapeHtml(options.contextLabel)}</span>` : ""}</header>`,
    `${spaces}  <ul class="spec-list">`,
    ...options.rows.map((row) => `${spaces}    ${row}`),
    `${spaces}  </ul>`,
    ...(options.contextLabel
      ? [
          `${spaces}  <div class="relation-resizer" role="separator" tabindex="0" aria-label="Resize relation columns" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50" title="Resize relation columns"></div>`,
        ]
      : []),
    `${spaces}</section>`,
  );
}

function relationPeerLabel(group: RelationGroup): string {
  // Peers share the current artifact's relation to the row: "Also implemented by", "Also delivered".
  const passive = relationLabels[group.kind].incoming.toLowerCase();
  return `Also ${group.direction === "outgoing" ? passive : passive.replace(/ by$/, "")}`;
}

function renderRelationPeers(
  graph: SpecGraph,
  current: Artifact,
  related: Artifact,
  group: RelationGroup,
): string {
  const siblings = relationPeers(graph, current, related, group).filter(
    (peer) => artifactKey(peer) !== artifactKey(current),
  );
  if (!siblings.length) return "";
  const links = siblings.map(
    (peer) =>
      `<a class="relation-peer" href="#${artifactAnchor(peer)}" aria-label="${escapeAttribute(`${peer.id} - ${peer.title}`)}" title="${escapeAttribute(peer.id)}">${specIcon(peer.kind)}${escapeHtml(peer.title)}</a>`,
  );
  return `<p class="relation-context"><span>${escapeHtml(relationPeerLabel(group))}:</span> ${links.join(", ")}</p>`;
}

function renderArtifact(
  lines: string[],
  artifact: Artifact,
  indentation: number,
  testInventory?: readonly TestEntry[],
): void {
  const spaces = " ".repeat(indentation);
  for (const bound of boundFields(artifact)) {
    switch (bound.kind) {
      case "paragraph":
        lines.push(
          `${spaces}<p ${textBinding(bound.key, bound.value)}>${richText(bound.value)}</p>`,
        );
        break;
      case "inline": {
        const value =
          typeof bound.value === "string"
            ? `<span ${textBinding(bound.key, bound.value)}>${richText(bound.value)}</span>`
            : `<span data-source-path="${bound.key}">${richText(bound.value.join(", "))}</span>`;
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
      case "criteria":
        renderListBox(
          lines,
          {
            heading: `${artifactAnchor(artifact)}-criteria`,
            title: bound.label,
            className: "spec-criteria",
            headingLevel: 4,
            rows: bound.value.map((criterion, index) => {
              const tests = criterionTests(
                testInventory,
                artifact,
                criterion.id,
              );
              return `<li class="criterion-item" id="${escapeAttribute(criterionAnchor(artifact, criterion.id))}"><div class="spec-list-content" title="${escapeAttribute(plainText(criterion.description))}"><span ${textBinding(`${bound.key}.${index}.description`, criterion.description)}>${richText(criterion.description)}</span></div><p class="criterion-meta"><span class="spec-list-id" data-source-path="${bound.key}.${index}.id">${escapeHtml(criterion.id)}</span></p>${criterionTestList(criterion.id, tests)}</li>`;
            }),
          },
          indentation,
        );
        break;
      case "code":
        renderCodeBlocks(lines, bound.value, indentation, bound.key);
        break;
      case "diagram":
        renderCodeBlocks(lines, [bound.value], indentation, bound.key, true);
        break;
      case "tasks":
        renderTasks(lines, bound.label, bound.key, bound.value, indentation);
        break;
    }
  }
}

function artifactLink(artifact: Artifact, row = false): string {
  const label = row
    ? `<span class="spec-list-label"><span class="spec-list-id">${escapeHtml(artifact.id)}</span> <span>${escapeHtml(artifact.title)}</span></span>`
    : `<span>${artifactLabel(artifact)}</span>`;
  return `<a class="artifact-link${row ? " spec-list-content" : ""}" href="#${artifactAnchor(artifact)}" data-source-anchor="${artifactAnchor(artifact)}"${row ? ` title="${escapeAttribute(`${artifact.id} - ${artifact.title}`)}"` : ""}>${specIcon(artifact.kind)}${label}</a>`;
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
      `${spaces}  <li ${textBinding(`${key}.${index}`, value)}>${richText(value)}</li>`,
    ),
  );
  lines.push(`${spaces}</${tag}>`);
}

function renderCodeBlocks(
  lines: string[],
  blocks: readonly Diagram[] | undefined,
  indentation: number,
  key?: string,
  single = false,
  captions = true,
  className = "",
): void {
  const spaces = " ".repeat(indentation);
  for (const [index, block] of (blocks ?? []).entries()) {
    const path = key ? (single ? key : `${key}.${index}`) : undefined;
    const title = path
      ? `<span data-path="${path}.title">${escapeHtml(block.title)}</span>`
      : escapeHtml(block.title);
    lines.push(
      captions
        ? `${spaces}<figure class="spec-diagram${className}">`
        : `${spaces}<figure class="spec-diagram${className}" aria-label="${escapeAttribute(block.title)}">`,
      ...(captions ? [`${spaces}  <figcaption>${title}</figcaption>`] : []),
    );
    if (isFigure(block)) {
      const source = path ? ` data-source-path="${path}"` : "";
      lines.push(
        `${spaces}  ${figureImage(block.excalidraw, block.title, source)}`,
      );
    } else {
      const source = path ? ` data-source-path="${path}.source"` : "";
      lines.push(
        `${spaces}  <pre${source}><code class="language-${escapeAttribute(block.language)}">${escapeHtml(block.source)}</code></pre>`,
      );
    }
    lines.push(`${spaces}</figure>`);
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
  lines.push(
    `${spaces}<h4>${escapeHtml(title)}</h4>`,
    `${spaces}<ul class="task-list">`,
  );
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
    `${spaces}<li><label class="task-label"><input type="checkbox" data-path="${path}.done"${checked} disabled> <span ${textBinding(`${path}.text`, task.text)}>${richText(task.text)}</span></label>`,
  );
  if (task.children?.length) {
    lines.push(`${spaces}  <ul class="task-list">`);
    task.children.forEach((child, index) =>
      renderTask(lines, child, `${path}.children.${index}`, indentation + 4),
    );
    lines.push(`${spaces}  </ul>`);
  }
  lines.push(`${spaces}</li>`);
}

// Text holding figure tokens comes from a template literal; it can be opened in source but not edited inline.
function textBinding(path: string, value: string): string {
  return `${figureParts(value).some((part) => typeof part !== "string") ? "data-source-path" : "data-path"}="${path}"`;
}

function plainText(value: string): string {
  return figureParts(value)
    .map((part) => (typeof part === "string" ? part : part.title))
    .join("");
}

function richText(value: string): string {
  return figureParts(value)
    .map((part) =>
      typeof part === "string"
        ? escapeHtml(part)
        : part.embed
          ? figureImage(part.excalidraw, part.title)
          : `<a class="figure-ref" href="${escapeAttribute(part.excalidraw)}" data-excalidraw="${escapeAttribute(part.excalidraw)}">${escapeHtml(part.title)}</a>`,
    )
    .join("");
}

function figureImage(url: string, title: string, attributes = ""): string {
  return `<span class="excalidraw-figure" data-excalidraw="${escapeAttribute(url)}" data-title="${escapeAttribute(title)}"${attributes}><img src="${escapeAttribute(url)}" alt="${escapeAttribute(title)}"></span>`;
}

// Rewrites figure `src`/`href` attributes, e.g. to paths relative to an exported file.
function mapFigureHrefs(
  html: string,
  figureHref: FigureHref | undefined,
): string {
  if (!figureHref) return html;
  return html.replace(
    /\b(src|href)="([^"]+\.excalidraw\.svg)"/g,
    (_match, name: string, url: string) =>
      `${name}="${escapeAttribute(figureHref(url.replaceAll("&amp;", "&")))}"`,
  );
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
