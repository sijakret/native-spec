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
import { pathToFileURL } from "node:url";
import * as ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  browserStorage,
  cdnApp,
  firstSliceSprint,
  inventory,
  inventoryDesk,
  orderLifecycle,
  stockDomain,
} from "./artifacts/index.js";
import {
  buildGraph,
  delivers,
  implementsRequirement,
} from "./definition/process.js";
import project from "./definition/project.js";
import type { CodeEntry, TestEntry } from "./audit/code-audit.js";
import {
  renderArtifactFragment,
  renderSpecPanel,
} from "./utils/output/html.js";
import {
  artifactAnchor,
  artifactAnchors,
  relationPeers,
} from "./utils/output/rendering.js";
import {
  codeSourceLocation,
  findSpecsDirectory,
} from "./utils/spec-viewer/src/project.js";
import { themeColor } from "./utils/spec-viewer/src/webview/figure-colors.js";
import {
  artifactSourceRange,
  editArtifactSource,
  parseFieldPath,
} from "./utils/spec-viewer/src/edits.js";

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
    expect(() => findSpecsDirectory(root, artifactAt(root), "specs")).toThrow(
      "Check the nativeSpec.specsFolder setting.",
    );
  });

  it("rejects documents outside the workspace", () => {
    projectAt(root);
    expect(() =>
      findSpecsDirectory(root, artifactAt(`${root}-other`), "specs"),
    ).toThrow("Open the artifact inside its workspace.");
  });
});

describe("code link rendering", () => {
  it("resolves project-relative declarations and converts their coordinates for VS Code", () => {
    const specs = join(import.meta.dirname);
    expect(codeSourceLocation(specs, "src/domain.ts", 72, 10)).toEqual({
      file: join(dirname(specs), "src/domain.ts"),
      line: 71,
      column: 9,
    });
    expect(codeSourceLocation(specs, "specs/audit/code-audit.ts").file).toBe(
      join(specs, "audit/code-audit.ts"),
    );
    for (const file of ["../outside.ts", "/tmp/outside.ts", ""]) {
      expect(() => codeSourceLocation(specs, file)).toThrow(
        "inside the spec project",
      );
    }
    for (const coordinate of [0, -1, 1.5, NaN, Infinity]) {
      expect(() =>
        codeSourceLocation(specs, "src/domain.ts", coordinate),
      ).toThrow("positive line and column");
      expect(() =>
        codeSourceLocation(specs, "src/domain.ts", 1, coordinate),
      ).toThrow("positive line and column");
    }
  });

  const entry: CodeEntry = {
    file: "src/domain.ts",
    symbol: "record",
    kind: "function",
    line: 72,
    column: 1,
    endLine: 76,
    architectureBlocks: [stockDomain.id],
    requirements: [inventory.id],
  };

  it("renders owned code declarations with source coordinates, without inherited callbacks", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      [stockDomain],
      "overview",
      [
        { ...entry, symbol: "<module>", kind: "module", line: 1 },
        entry,
        {
          ...entry,
          symbol: "<callback@73:1>",
          kind: "callback",
          inheritedFrom: "src/domain.ts#record",
        },
        { ...entry, symbol: "save", architectureBlocks: [browserStorage.id] },
      ],
    );
    const section = html.match(
      /<section class="spec-list-box spec-code-links"[\s\S]*?<\/section>/,
    )?.[0];
    expect(section).toContain(
      '<h4 id="abb-001-code-links">Code Links</h4><span class="count-badge">2</span>',
    );
    expect(section).toContain(
      'data-code-file="src/domain.ts" data-code-line="72" data-code-column="1"',
    );
    expect(section).toContain("<code>record</code>");
    expect(section).toContain("src/domain.ts:72");
    expect(section).not.toContain("callback");
    expect(section).not.toContain("<code>save</code>");
  });

  it("groups code declarations by escaped file path in collapsed native disclosures", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      [stockDomain],
      "overview",
      [
        entry,
        { ...entry, file: "src/extra<&>.ts", symbol: "other" },
        { ...entry, symbol: "second", line: 80 },
      ],
    );
    const groups = [
      ...html.matchAll(
        /<details class="code-link-file">([\s\S]*?)<\/details>/g,
      ),
    ];
    expect(groups).toHaveLength(2);
    expect(groups[0]?.[1]).toContain(
      '<code>src/domain.ts</code><span class="count-badge">2</span>',
    );
    expect(groups[0]?.[1]).toContain("<code>record</code>");
    expect(groups[0]?.[1]).toContain("<code>second</code>");
    expect(groups[0]?.[1]).not.toContain("<code>other</code>");
    expect(groups[1]?.[1]).toContain("<code>src/extra&lt;&amp;&gt;.ts</code>");
    expect(groups[1]?.[1]).toContain("<code>other</code>");
    expect(html).toContain(
      '<h4 id="abb-001-code-links">Code Links</h4><span class="count-badge">3</span>',
    );
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("does not add code lists to requirements, architecture overviews, or callers without inventory", () => {
    const graph = buildGraph(project);
    expect(
      renderSpecPanel(graph, project, [inventory], "overview", [entry]),
    ).not.toContain("spec-code-links");
    expect(
      renderSpecPanel(graph, project, undefined, "architecture", [entry]),
    ).not.toContain("spec-code-links");
    expect(renderSpecPanel(graph, project, [stockDomain])).not.toContain(
      "spec-code-links",
    );
  });
});

describe("native test link rendering", () => {
  const entry: TestEntry = {
    kind: "test",
    file: "tests/domain.test.ts",
    symbol: "seededInventory",
    line: 20,
    column: 1,
    endLine: 30,
    verifications: [
      { requirement: inventory.id, criterion: "search" },
      { requirement: inventory.id, criterion: "overview" },
      { requirement: orderLifecycle.id, criterion: "reserve-stock" },
    ],
  };

  it("renders actual test source links inside their acceptance criteria, not in a separate section", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      [inventory],
      "overview",
      undefined,
      [entry],
    );
    expect(html).not.toContain("spec-test-links");
    expect(html).toContain('aria-label="Tests for search"');
    expect(html).toContain('aria-label="Tests for overview"');
    expect(html).not.toContain('aria-label="Tests for availability"');
    expect(html).not.toContain('aria-label="Tests for reserve-stock"');
    expect(html).toContain(
      'data-code-file="tests/domain.test.ts" data-code-line="20" data-code-column="1"',
    );
    expect(html.match(/<code>seededInventory<\/code>/g)).toHaveLength(2);
  });

  it("associates several tests or a suite directly with the selected criterion", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      [inventory],
      "overview",
      undefined,
      [
        {
          ...entry,
          verifications: [{ requirement: inventory.id, criterion: "search" }],
        },
        {
          ...entry,
          symbol: "anotherCheck",
          line: 40,
          verifications: [{ requirement: inventory.id, criterion: "search" }],
        },
        {
          ...entry,
          kind: "suite",
          symbol: "stockSuite",
          verifications: [
            { requirement: inventory.id, criterion: "availability" },
          ],
        },
      ],
    );
    const search = html
      .split('aria-label="Tests for search"')[1]
      ?.split("</ul>")[0];
    expect(search).toContain("<code>seededInventory</code>");
    expect(search).toContain("<code>anotherCheck</code>");
    expect(search).not.toContain("stockSuite");
    const availability = html
      .split('aria-label="Tests for availability"')[1]
      ?.split("</ul>")[0];
    expect(availability).toContain(
      '<code>stockSuite</code><span class="test-kind">suite</span>',
    );
    expect(availability).not.toContain("seededInventory");
  });

  it("lists each criterion's tests on one line per file, with source coordinates and escaping", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      [inventory],
      "overview",
      undefined,
      [
        {
          ...entry,
          verifications: [{ requirement: inventory.id, criterion: "search" }],
        },
        {
          ...entry,
          symbol: "second",
          line: 42,
          verifications: [{ requirement: inventory.id, criterion: "search" }],
        },
        {
          ...entry,
          kind: "suite",
          file: "tests/other<&>.test.ts",
          symbol: "suite",
          verifications: [{ requirement: inventory.id, criterion: "search" }],
        },
      ],
    );
    const search = html
      .split('aria-label="Tests for search"')[1]
      ?.split("</ul>")[0];
    const groups = [...(search ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)];
    expect(groups).toHaveLength(2);
    expect(groups[0]?.[1]).toContain(
      '<span class="criterion-test-file">tests/domain.test.ts</span>',
    );
    expect(groups[0]?.[1]).toContain("<code>seededInventory</code>");
    expect(groups[0]?.[1]).toContain("<code>second</code>");
    expect(groups[0]?.[1]).toContain(
      'data-code-file="tests/domain.test.ts" data-code-line="42" data-code-column="1"',
    );
    expect(groups[1]?.[1]).toContain(
      '<span class="criterion-test-file">tests/other&lt;&amp;&gt;.test.ts</span>',
    );
    expect(groups[1]?.[1]).toContain(
      '<code>suite</code><span class="test-kind">suite</span>',
    );
    expect(groups[0]?.[1]).not.toContain("test-kind");
    expect(html).not.toContain("<details");
  });

  it("omits test lists without matching links and escapes source names", () => {
    const graph = buildGraph(project);
    expect(
      renderSpecPanel(graph, project, [inventory], "overview", undefined, []),
    ).not.toContain("spec-test-links");
    expect(
      renderSpecPanel(graph, project, [stockDomain], "overview", undefined, [
        entry,
      ]),
    ).not.toContain("spec-test-links");
    const html = renderSpecPanel(
      graph,
      project,
      [inventory],
      "overview",
      undefined,
      [{ ...entry, symbol: '<test & "name">' }],
    );
    expect(html).toContain("&lt;test &amp; &quot;name&quot;&gt;");
    expect(html).not.toContain('<test & "name">');
  });
});

describe("acceptance criterion navigation", () => {
  it("renders criteria with the shared counted list box and preserves source bindings", () => {
    const html = renderSpecPanel(buildGraph(project), project, [inventory]);
    const criteria = html.match(
      /<section class="spec-list-box spec-criteria"[\s\S]*?<\/section>/,
    )?.[0];
    expect(criteria).toBeDefined();
    expect(criteria).toContain('aria-labelledby="req-sr-001-criteria"');
    expect(criteria).toContain(
      '<h4 id="req-sr-001-criteria">Acceptance Criteria</h4><span class="count-badge">4</span>',
    );
    expect(criteria).toContain('<ul class="spec-list">');
    expect(criteria?.match(/<li class="criterion-item" id=/g)).toHaveLength(4);
    expect(criteria).toContain('id="req-sr-001-ac-search"');
    expect(criteria).toContain(
      'class="spec-list-id" data-source-path="acceptanceCriteria.0.id"',
    );
    expect(criteria).toContain('data-path="acceptanceCriteria.0.description"');
    expect(criteria).toContain(
      '<p class="criterion-meta"><span class="spec-list-id" data-source-path="acceptanceCriteria.0.id">search</span></p>',
    );
    expect(criteria).not.toContain('href="#tc-001"');
    expect(html).toContain('class="spec-list-box relation-card"');
  });

  it("resolves criterion anchors to their owning artifact", () => {
    expect(artifactAnchors(inventory)).toEqual([
      "req-sr-001",
      "req-sr-001-ac-search",
      "req-sr-001-ac-availability",
      "req-sr-001-ac-restock",
      "req-sr-001-ac-overview",
    ]);
    expect(artifactAnchors(firstSliceSprint)).toEqual(["sprint-0001"]);
    expect(
      project.artifacts.find((artifact) =>
        artifactAnchors(artifact).includes("req-sr-001-ac-search"),
      ),
    ).toBe(inventory);
  });
});

describe("relation peer counts", () => {
  const secondBlock = browserStorage;
  const fixture = {
    ...project,
    relations: [
      implementsRequirement(stockDomain, inventory),
      implementsRequirement(secondBlock, inventory),
      implementsRequirement(stockDomain, orderLifecycle),
      implementsRequirement(stockDomain, cdnApp),
      delivers(firstSliceSprint, inventory),
      delivers(firstSliceSprint, orderLifecycle),
      delivers(firstSliceSprint, cdnApp),
    ],
  };
  const graph = buildGraph(fixture);

  it("counts distinct implementers, not unrelated links to the requirement", () => {
    expect(
      relationPeers(graph, stockDomain, inventory, {
        kind: "implements",
        direction: "outgoing",
      }).map((artifact) => artifact.id),
    ).toEqual(["ABB-001", "ABB-002"]);
  });

  it("reverses incoming views and keeps software and non-functional peers separate", () => {
    expect(
      relationPeers(graph, inventory, stockDomain, {
        kind: "implements",
        direction: "incoming",
      }).map((artifact) => artifact.id),
    ).toEqual(["REQ-SR-001", "REQ-SR-002"]);
    expect(
      relationPeers(graph, cdnApp, stockDomain, {
        kind: "implements",
        direction: "incoming",
      }).map((artifact) => artifact.id),
    ).toEqual(["REQ-NFR-001"]);
    expect(
      relationPeers(graph, inventory, firstSliceSprint, {
        kind: "delivers",
        direction: "incoming",
      }).map((artifact) => artifact.id),
    ).toEqual(["REQ-SR-001", "REQ-SR-002"]);
  });

  it("deduplicates repeated canonical edges", () => {
    const duplicated = buildGraph({
      ...fixture,
      relations: [
        ...fixture.relations,
        implementsRequirement(stockDomain, inventory),
      ],
    });
    expect(
      relationPeers(duplicated, stockDomain, inventory, {
        kind: "implements",
        direction: "outgoing",
      }),
    ).toHaveLength(2);
  });

  it("reports missing peers and direction mismatches explicitly", () => {
    const missing = buildGraph({
      ...fixture,
      artifacts: project.artifacts.filter(
        (artifact) => artifact.id !== secondBlock.id,
      ),
    });
    expect(() =>
      relationPeers(missing, stockDomain, inventory, {
        kind: "implements",
        direction: "outgoing",
      }),
    ).toThrow("Cannot count missing relation peer: architecture-block:ABB-002");
    expect(() =>
      relationPeers(graph, stockDomain, inventory, {
        kind: "implements",
        direction: "incoming",
      }),
    ).toThrow(
      "No implements link between ABB-001 and REQ-SR-001 in this direction.",
    );
  });

  it("shows other implementers in a smaller second line without a widget", () => {
    const html = renderSpecPanel(graph, fixture, [stockDomain]);
    expect(html).toContain(
      '<p class="relation-context"><span>Also implemented by:</span> ',
    );
    expect(html).toContain(
      '<a class="relation-peer" href="#abb-002" aria-label="ABB-002 - Validated Browser Storage" title="ABB-002"><svg class="spec-icon" data-icon="architecture-block"',
    );
    expect(html.match(/class="relation-context"/g)).toHaveLength(1);
    expect(html.match(/class="relation-peer"/g)).toHaveLength(1);
    expect(html).toContain(
      'class="spec-list-box relation-card" data-peer-context',
    );
    expect(html).toContain(
      '<span class="relation-context-heading" aria-hidden="true">Also implemented by</span>',
    );
    expect(html).toContain(
      'class="relation-resizer" role="separator" tabindex="0" aria-label="Resize relation columns" aria-orientation="vertical" aria-valuemin="20" aria-valuemax="80" aria-valuenow="50"',
    );
    expect(html).not.toContain("popover");
    expect(html).not.toContain('class="relation-peers"');
    expect(html).not.toContain('class="peer-');
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain('href="#abb-001"');
  });

  it("omits the second line when there are no other peers", () => {
    const sole = {
      ...project,
      relations: [implementsRequirement(stockDomain, inventory)],
    };
    const html = renderSpecPanel(buildGraph(sole), sole, [stockDomain]);
    expect(html).not.toContain('class="relation-context"');
    expect(html).not.toContain('class="relation-peer"');
    expect(html).not.toContain("data-peer-context");
    expect(html).not.toContain('class="relation-context-heading"');
    expect(html).not.toContain('class="relation-resizer"');
    expect(html).not.toContain('class="peer-');
    expect(html).toContain(
      'href="#req-sr-001" data-source-anchor="req-sr-001"',
    );
  });

  it("labels peers of incoming relations as also implemented and also delivered", () => {
    const html = renderSpecPanel(graph, fixture, [inventory]);
    expect(html).toContain("<span>Also implemented:</span>");
    expect(html).toContain("<span>Also delivered:</span>");
    expect(html).toContain(
      'class="relation-context-heading" aria-hidden="true">Also implemented</span>',
    );
    expect(html).toContain(
      'class="relation-context-heading" aria-hidden="true">Also delivered</span>',
    );
    expect(html.match(/class="relation-context"/g)).toHaveLength(2);
    expect(
      html.match(/class="relation-peer" href="#req-sr-002"/g),
    ).toHaveLength(2);
    expect(html).not.toContain('class="relation-peer" href="#req-nfr-001"');
    expect(html).not.toContain('class="relation-peer" href="#req-sr-001"');
  });

  it("separates other peer titles with commas and excludes the current item", () => {
    const html = renderSpecPanel(buildGraph(project), project, [inventory]);
    expect(html.match(/class="relation-peer"/g)).toHaveLength(8);
    expect(html).toContain('class="relation-peer" href="#req-sr-002"');
    expect(html).toContain('class="relation-peer" href="#req-sr-003"');
    expect(html).toMatch(
      /class="relation-peer" href="#req-sr-002"[^>]*><svg class="spec-icon" data-icon="software-requirement" width="16"/,
    );
    expect(html).toMatch(/<\/a>, <a class="relation-peer"/);
    expect(html).not.toContain('href="#req-sr-001"');
  });

  it.each([1, 2, 3, 6, 7, 100])(
    "links every other sibling without a graph for %i peers",
    (total) => {
      const digits = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
      ] as const;
      const peers = digits.flatMap((tens) =>
        digits.map(
          (ones) =>
            ({
              ...stockDomain,
              id: `ABB-0${tens}${ones}`,
            }) as const,
        ),
      );
      const selected = [
        stockDomain,
        ...peers.filter((peer) => peer.id !== stockDomain.id),
      ].slice(0, total);
      const large = {
        ...project,
        artifacts: [
          ...project.artifacts.filter(
            (artifact) => artifact.kind !== "architecture-block",
          ),
          ...selected,
        ],
        relations: selected.map((peer) =>
          implementsRequirement(peer, inventory),
        ),
      };
      const html = renderSpecPanel(buildGraph(large), large, [stockDomain]);
      expect(html.match(/class="relation-peer"/g) ?? []).toHaveLength(
        total - 1,
      );
      expect(html).not.toContain('class="peer-');
      expect(html).not.toContain("aria-expanded");
      expect(html).not.toContain('href="#abb-001"');
      for (const peer of selected.filter((peer) => peer.id !== stockDomain.id))
        expect(html).toContain(
          `class="relation-peer" href="#${artifactAnchor(peer)}"`,
        );
      expect(html.match(/class="relation-context"/g) ?? []).toHaveLength(
        total > 1 ? 1 : 0,
      );
    },
  );

  it("escapes sibling labels without repeating the current item", () => {
    const escaped = {
      ...fixture,
      artifacts: fixture.artifacts.map((artifact) =>
        artifact.id === secondBlock.id
          ? { ...artifact, title: '<Sibling> & "draft"' }
          : artifact,
      ),
    };
    const html = renderSpecPanel(buildGraph(escaped), escaped, [stockDomain]);
    expect(html).toContain("&lt;Sibling&gt; &amp; &quot;draft&quot;");
    expect(html).not.toContain("<Sibling>");
    expect(html).not.toContain('href="#abb-001"');
  });

  it("deduplicates peer links when canonical edges are repeated", () => {
    const duplicated = {
      ...fixture,
      relations: [
        ...fixture.relations,
        implementsRequirement(secondBlock, inventory),
      ],
    };
    const html = renderSpecPanel(buildGraph(duplicated), duplicated, [
      stockDomain,
    ]);
    expect(html.match(/class="relation-peer" href="#abb-002"/g)).toHaveLength(
      1,
    );
  });
});

describe("spec viewer rendering", () => {
  it("shows intended uses and the system diagram in both project overview views", () => {
    const graph = buildGraph(project);
    for (const html of [
      renderSpecPanel(graph, project),
      renderArtifactFragment(graph, [], project),
    ]) {
      expect(html).toContain(
        '<h2 id="spec-intended-uses-title">Intended uses</h2>',
      );
      expect(html).toContain("<figcaption>Architecture overview</figcaption>");
      expect(html).toContain("000-architecture.figure-001.excalidraw.svg");
      for (const use of project.overview!.intendedUses!)
        expect(html).toContain(`<li>${use}</li>`);
    }
  });

  it("renders a landing page with metrics and links to every artifact", () => {
    const html = renderSpecPanel(buildGraph(project), project);
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('<span aria-current="page">Overview</span>');
    expect(html).not.toContain("spec-navigation");
    expect(html).not.toContain("data-toggle-navigation");
    expect(html).toContain("Browse specification");
    expect(html).toContain(`<dd>${project.artifacts.length}</dd>`);
    expect(html).not.toContain("<article");
    for (const artifact of project.artifacts)
      expect(html).toContain(`href="#${artifactAnchor(artifact)}"`);
  });

  it("introduces the architecture with diagrams before linking only to building blocks", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      project,
      undefined,
      "architecture",
    );
    expect(html).toContain("<h1>Acme Stockroom Architecture</h1>");
    expect(html).toContain('<article id="spec-architecture"');
    expect(html).not.toContain("<figcaption");
    expect(html).toContain('aria-label="Architecture overview"');
    expect(html).toContain("000-architecture.figure-001.excalidraw.svg");
    expect(html.indexOf('aria-label="Architecture overview"')).toBeLessThan(
      html.indexOf('id="architecture-blocks-title"'),
    );
    expect(html).not.toContain("Browse specification");
    expect(html).not.toContain("spec-metrics");
    expect(html).not.toContain("Intended uses");
    expect(html.match(/class="architecture-block-copy"/g)).toHaveLength(3);
    for (const artifact of project.artifacts) {
      if (artifact.kind === "architecture-block") {
        expect(html).toContain(`href="#${artifactAnchor(artifact)}"`);
        expect(html).toContain(artifact.description);
        expect(html).toContain(`aria-label="${artifact.summaryDiagram.title}"`);
        if ("excalidraw" in artifact.summaryDiagram)
          expect(html).toContain(
            `data-excalidraw="${artifact.summaryDiagram.excalidraw}"`,
          );
      } else {
        expect(html).not.toContain(`href="#${artifactAnchor(artifact)}"`);
      }
    }
  });

  it("links the catalog and ABB breadcrumbs to the architecture introduction", () => {
    const graph = buildGraph(project);
    expect(renderSpecPanel(graph, project)).toContain(
      'href="#spec-architecture"',
    );
    const html = renderSpecPanel(graph, project, [stockDomain]);
    expect(html).toContain('<a href="#spec-architecture">Architecture</a>');
    expect(html).toContain('href="#spec-overview"');
  });

  it("maps the single summary diagram to its actual source field", () => {
    const html = renderSpecPanel(buildGraph(project), project, [stockDomain]);
    expect(html).toContain('data-path="summaryDiagram.title"');
    expect(html).toContain('data-source-path="summaryDiagram"');
    expect(html).not.toContain('data-path="summaryDiagram.0.title"');
  });

  it("edits summary captions in figure helper calls without changing the sidecar reference", () => {
    const source = readFileSync(
      join(
        import.meta.dirname,
        "artifacts/architecture/001-stock-domain.abb.ts",
      ),
      "utf8",
    );
    const edit = editArtifactSource(
      ts,
      source,
      ["summaryDiagram", "title"],
      "Edited summary",
    );
    expect(source.slice(edit.start, edit.end)).toBe(
      '"Stock and order domain summary"',
    );
    const updated =
      source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    expect(updated).toContain('figure(import.meta.url, 2, "Edited summary")');
  });

  it("keeps overview breadcrumbs and relation links without a sidebar", () => {
    const html = renderSpecPanel(buildGraph(project), project, [inventory]);
    expect(html).toContain('href="#spec-overview"');
    expect(html).toMatch(
      /<span aria-current="page"><svg[^>]+data-icon="software-requirement"/,
    );
    expect(html).toContain("REQ-SR-001</span>");
    expect(html.match(/<span aria-current="page">/g)).toHaveLength(1);
    expect(html).toContain('<article id="req-sr-001">');
    expect(html).toContain('href="#req-mr-001"');
    expect(html).not.toContain("Browse specification");
    expect(html).not.toContain("spec-navigation");
    expect(html).not.toContain("data-toggle-navigation");
  });

  it("uses unsaved titles and escapes project and artifact text", () => {
    const html = renderSpecPanel(
      buildGraph(project),
      { ...project, title: '<Project "notes">' },
      [{ ...inventory, title: 'Search <notes> & "thoughts"' }],
    );
    expect(html).toContain("&lt;Project &quot;notes&quot;&gt;");
    expect(html).toContain(
      '<span data-path="title">Search &lt;notes&gt; &amp; &quot;thoughts&quot;</span>',
    );
    expect(html).not.toContain("<notes>");
  });

  it("only shows artifact kinds present in a tailored model", () => {
    const tailored = {
      ...project,
      artifacts: [inventory],
      relations: [],
    };
    const html = renderSpecPanel(buildGraph(tailored), tailored);
    expect(html).toContain("Software Requirements");
    expect(html).not.toContain("Market Requirements");
    expect(html).not.toContain("Risks");
    expect(html).not.toContain("Sprints");
  });

  it("provides an empty landing page before any artifacts exist", () => {
    const empty = {
      id: "empty",
      title: "Empty spec",
      artifacts: [],
      relations: [],
    };
    const html = renderSpecPanel(buildGraph(empty), empty);
    expect(html).toContain("No artifacts yet.");
    expect(html).toContain("<dd>0</dd>");
    expect(html).toContain('<span aria-current="page">Overview</span>');
  });

  it("provides themed project and artifact icons plus a source switch", () => {
    const html = renderSpecPanel(buildGraph(project), project);
    expect(html).toContain('class="spec-project-link"');
    expect(html).toContain('data-icon="project"');
    expect(html).toContain('data-open-source aria-label="Open Source"');
    expect(html).toMatch(
      /<button class="source-button"[^>]*><svg\b[\s\S]*?<\/svg><\/button>/,
    );
    for (const kind of new Set(
      project.artifacts.map((artifact) => artifact.kind),
    ))
      expect(html).toContain(`data-icon="${kind}"`);
    expect(html).toContain('aria-hidden="true" focusable="false"');
    expect(html).toContain(`data-source-anchor="${artifactAnchor(inventory)}"`);
  });

  it("binds read-only IDs, tags, and diagrams to source without making them editable", () => {
    const html = renderSpecPanel(buildGraph(project), project, [inventoryDesk]);
    expect(html).toContain('data-source-path="id"');
    expect(html).toContain('data-source-path="tags"');
    expect(html).toContain('data-source-path="diagrams.0.source"');
    expect(html).toContain(
      '<figcaption><span data-path="diagrams.0.title">Runtime boundaries</span></figcaption>',
    );
    expect(html).not.toContain('data-path="diagrams.0.source"');
  });

  it("uses aligned, bullet-free checklists for tasks, nested tasks, and sprint reviews", () => {
    const sprint = {
      ...firstSliceSprint,
      tasks: [
        {
          text: "Parent task that can wrap",
          done: false,
          children: [{ text: "Nested task", done: true }],
        },
      ],
    } satisfies typeof firstSliceSprint;
    const html = renderSpecPanel(buildGraph(project), project, [sprint]);
    expect(html.match(/<ul class="task-list">/g)).toHaveLength(4);
    // Two tasks, three architecture reviews, and one documentation check.
    expect(html.match(/<label class="task-label">/g)).toHaveLength(6);
    expect(html).toContain(
      '<input type="checkbox" data-path="tasks.0.done" disabled>',
    );
    expect(html).toContain(
      '<input type="checkbox" data-path="tasks.0.children.0.done" checked disabled>',
    );
    expect(html).toContain(
      '<span data-path="tasks.0.children.0.text">Nested task</span>',
    );
    expect(html).toContain('data-path="architectureReview.0.text"');
    expect(html).toContain('data-path="documentationIntegrity.0.text"');
  });

  it("escapes diagram captions and keeps each title bound to its own source field", () => {
    const html = renderSpecPanel(buildGraph(project), project, [
      {
        ...stockDomain,
        diagrams: [
          {
            title: '<Runtime> & "storage"',
            language: "mermaid",
            source: "flowchart LR\nA-->B",
          },
          {
            title: "Audit boundaries",
            language: "mermaid",
            source: "flowchart LR\nC-->D",
          },
        ],
      },
    ]);
    expect(html).toContain(
      '<figcaption><span data-path="diagrams.0.title">&lt;Runtime&gt; &amp; &quot;storage&quot;</span></figcaption>',
    );
    expect(html).toContain(
      '<figcaption><span data-path="diagrams.1.title">Audit boundaries</span></figcaption>',
    );
    expect(html).toContain('data-source-path="diagrams.1.source"');
    expect(html).not.toContain("<Runtime>");
  });

  it("renders relation groups as counted cards with one artifact per list row", () => {
    const html = renderSpecPanel(buildGraph(project), project, [inventoryDesk]);
    expect(html).toContain(
      'class="spec-relations" aria-labelledby="abb-003-relations"',
    );
    expect(html.match(/class="spec-list-box relation-card"/g)).toHaveLength(2);
    expect(html).toContain(
      '<h5 id="abb-003-relations-0">Implements</h5><span class="count-badge">4</span>',
    );
    expect(html).toContain(
      '<h5 id="abb-003-relations-1">Delivered by</h5><span class="count-badge">1</span>',
    );
    const rows = [
      ...html.matchAll(/<li class="relation-item">(<a[\s\S]*?<\/a>)/g),
    ];
    expect(rows).toHaveLength(5);
    const requirements = rows
      .slice(0, 4)
      .map((match) => match[1])
      .join("");
    for (const id of [
      "REQ-SR-001",
      "REQ-SR-002",
      "REQ-NFR-001",
      "REQ-SR-003",
    ]) {
      expect(requirements).toContain(
        `data-source-anchor="${id.toLowerCase()}"`,
      );
      expect(requirements).toContain(`<span class="spec-list-id">${id}</span>`);
    }
    expect(html).not.toContain("<strong>Implements:</strong>");
  });

  it("escapes related artifact titles while retaining row navigation targets", () => {
    const tailored = {
      ...project,
      artifacts: project.artifacts.map((artifact) =>
        artifact.id === inventory.id
          ? { ...artifact, title: '<Stock> & "orders"' }
          : artifact,
      ),
    };
    const html = renderSpecPanel(buildGraph(tailored), tailored, [stockDomain]);
    expect(html).toContain("&lt;Stock&gt; &amp; &quot;orders&quot;");
    expect(html).toContain(
      'href="#req-sr-001" data-source-anchor="req-sr-001"',
    );
    expect(html).not.toContain("<Stock>");
  });

  it("omits the relation-card section when an artifact has no relations", () => {
    const isolated = { ...project, artifacts: [inventory], relations: [] };
    const html = renderSpecPanel(buildGraph(isolated), isolated, [inventory]);
    expect(html).not.toContain('class="spec-relations"');
    expect(html).not.toContain('class="spec-list-box relation-card"');
  });

  it("registers the architecture overview with the visual editor", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "utils/spec-viewer/package.json"),
        "utf8",
      ),
    );
    const editor = manifest.contributes.customEditors.find(
      (candidate: { viewType: string }) =>
        candidate.viewType === "nativeSpec.artifact",
    );
    expect(editor.selector).toContainEqual({
      filenamePattern: "**/artifacts/architecture/000-architecture.ts",
    });
  });

  it("renders saved, unsaved, index, and architecture documents using the project's toolchain", () => {
    const specs = import.meta.dirname;
    const file = join(
      specs,
      "artifacts",
      "requirements",
      "001-inventory.sr.ts",
    );
    const source = readFileSync(file, "utf8");
    const index = join(specs, "artifacts", "index.ts");
    const architecture = join(
      specs,
      "artifacts",
      "architecture",
      "000-architecture.ts",
    );
    const architectureSource = readFileSync(architecture, "utf8");
    const abb = join(
      specs,
      "artifacts",
      "architecture",
      "001-stock-domain.abb.ts",
    );
    const project = findSpecsDirectory(dirname(specs), file, "specs");
    const require = createRequire(join(project, "package.json"));
    const withoutDesk = architectureSource.replace(
      /(browserStorage),\s*inventoryDesk,?(\s*\])/,
      "$1$2",
    );
    expect(withoutDesk).not.toBe(architectureSource);
    const requests = [
      { id: 0, path: file, source },
      {
        id: 1,
        path: file,
        source: source.replace(
          '"Inventory and Overview"',
          '"Unsaved search title"',
        ),
      },
      { id: 2, path: file, source: "export const notAnArtifact = 1;" },
      { id: 3, path: index, source: readFileSync(index, "utf8") },
      { id: 4, path: abb, source: readFileSync(abb, "utf8") },
      { id: 5, path: architecture, source: architectureSource },
      {
        id: 6,
        path: architecture,
        source: architectureSource
          .replace('"Architecture overview"', '"Unsaved architecture diagram"')
          .replace(
            "A single-user inventory and order desk:",
            "Unsaved architecture context:",
          ),
      },
      { id: 7, path: architecture, source: "export const notAnOverview = 1;" },
      { id: 8, path: architecture, source: architectureSource },
      {
        id: 9,
        path: architecture,
        source: withoutDesk,
      },
      { id: 10, path: architecture, source: architectureSource },
      {
        id: 11,
        path: abb,
        source: readFileSync(abb, "utf8").replace(
          "[typeof domain]",
          "[typeof domain.seedWorkspace]",
        ),
      },
    ];
    const result = spawnSync(
      process.execPath,
      [
        require.resolve("tsx/cli"),
        join(specs, "utils/spec-viewer/src/render.ts"),
        project,
      ],
      {
        cwd: project,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        input:
          requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
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
    expect(responses.map((response) => response.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    // The worker evaluates sources from data: URLs; figures must resolve beside the real file.
    expect(responses[4]?.html).toContain(
      `data-excalidraw="${pathToFileURL(abb.replace(/([^/]+)\.ts$/, "figures/$1.figure-001.excalidraw.svg")).href}"`,
    );
    expect(responses[4]?.error).toBeUndefined();
    expect(responses[4]?.html).toContain("spec-code-links");
    expect(responses[4]?.html).toContain("<code>seedWorkspace</code>");
    expect(responses[4]?.html).toContain("<code>record</code>");
    expect(responses[4]?.html).toContain("<code>Module</code>");
    expect(responses[11]?.error).toBeUndefined();
    expect(responses[11]?.html).not.toContain("<code>Module</code>");
    expect(responses[11]?.html).toContain("<code>record</code>");
    expect(responses[0]?.html).toContain('<article id="req-sr-001">');
    expect(responses[0]?.html).not.toContain("spec-test-links");
    expect(responses[0]?.html).toMatch(
      /id="req-sr-001-ac-search".*aria-label="Tests for search".*<code>seededInventory<\/code>/,
    );
    expect(responses[0]?.html).toMatch(
      /id="req-sr-001-ac-restock".*aria-label="Tests for restock".*<code>invalidQuantities<\/code>/,
    );
    expect(responses[0]?.html).toContain(
      'data-code-file="tests/domain.test.ts"',
    );
    expect(responses[0]?.locations?.["req-sr-001"]).toBe(file);
    expect(responses[0]?.locations?.["req-sr-001-ac-search"]).toBe(file);
    expect(responses[0]?.locations?.["req-sr-001-ac-overview"]).toBe(file);
    expect(responses[1]?.html).toContain("Unsaved search title");
    expect(responses[2]?.error).toContain("No artifact export found");
    expect(responses[0]?.locations?.["spec-overview"]).toBe(index);
    expect(responses[0]?.locations?.["spec-architecture"]).toBe(architecture);
    expect(responses[3]?.html).toContain("Browse specification");
    expect(responses[3]?.html).not.toContain("<article");
    expect(responses[5]?.error).toBeUndefined();
    expect(responses[5]?.html).toContain('<article id="spec-architecture"');
    expect(responses[5]?.html).toContain(
      'aria-current="page">Architecture</span>',
    );
    expect(responses[5]?.html).toContain('aria-label="Architecture overview"');
    expect(responses[5]?.html).not.toContain("<figcaption");
    expect(responses[5]?.html).toContain("ABB-003 - Inventory Desk UI");
    expect(responses[5]?.html).not.toContain("Browse specification");
    expect(responses[5]?.html).not.toContain("spec-metrics");
    expect(responses[5]?.html).not.toContain("Intended uses");
    expect(responses[5]?.html).not.toContain('href="#req-');
    expect(responses[5]?.html).not.toContain('href="#sprint-');
    expect(responses[5]?.html).not.toContain('href="#tc-');
    expect(responses[6]?.html).toContain(
      'aria-label="Unsaved architecture diagram"',
    );
    expect(responses[6]?.html).toContain("Unsaved architecture context:");
    expect(responses[6]?.html).not.toContain(
      'aria-label="Architecture overview"',
    );
    expect(responses[7]?.error).toContain(
      "No architectureOverview export found",
    );
    expect(responses[8]?.html).toContain('aria-label="Architecture overview"');
    expect(responses[8]?.html).not.toContain("Unsaved architecture");
    expect(responses[9]?.html).toBeUndefined();
    expect(responses[9]?.error).toContain(
      "Missing architecture overview block: architecture-block:ABB-003",
    );
    expect(responses[10]?.html).toContain('<article id="spec-architecture"');
  });

  describe("spec viewer source mapping", () => {
    const source = `export const sprint = artifact.sprint(({
      "title": "Unsaved sprint title",
      description: \`Line one
  Line two\`,
      acceptanceCriteria: [
        { id: "first", description: "First" },
        { id: "second", description: "Second" },
      ],
      diagrams: [{ title: "Stock flow", language: "mermaid", source: "flowchart LR\\nA-->B" }, sketch],
      tasks: [
        { text: "Parent", done: false, children: [completedTask("Child")] },
      ],
    } as const));`;

    const selected = (path: string): string => {
      const range = artifactSourceRange(ts, source, parseFieldPath(path));
      return source.slice(range.start, range.end);
    };

    it("selects exact values from unsaved text, including quoted keys", () => {
      expect(selected("title")).toBe('"Unsaved sprint title"');
      expect(selected("description")).toBe("`Line one\n  Line two`");
      expect(selected("acceptanceCriteria.1.id")).toBe('"second"');
      expect(selected("acceptanceCriteria.1.description")).toBe('"Second"');
    });

    it("selects nested tasks and completed-task helpers", () => {
      expect(selected("tasks.0.text")).toBe('"Parent"');
      expect(selected("tasks.0.done")).toBe("false");
      expect(selected("tasks.0.children.0.text")).toBe('"Child"');
      expect(selected("tasks.0.children.0.done")).toBe(
        'completedTask("Child")',
      );
    });

    it("selects the original Mermaid source rather than its rendered SVG", () => {
      expect(selected("diagrams.0.title")).toBe('"Stock flow"');
      expect(selected("diagrams.0.source")).toBe('"flowchart LR\\nA-->B"');
    });

    it("selects the figure reference for Excalidraw diagrams", () => {
      expect(selected("diagrams.1")).toBe("sketch");
    });

    it("reports missing or unsupported targets rather than selecting unrelated code", () => {
      expect(() => selected("missing")).toThrow("No property missing");
      expect(() => selected("tasks.5.text")).toThrow("No element 5");
      expect(() =>
        artifactSourceRange(ts, "export const x = 1", ["title"]),
      ).toThrow("No artifact");
    });

    it("preserves minimal text edits and task toggles using the shared resolver", () => {
      const title = editArtifactSource(ts, source, ["title"], "New title");
      expect(source.slice(title.start, title.end)).toBe(
        '"Unsaved sprint title"',
      );
      expect(title.text).toBe('"New title"');
      const toggle = editArtifactSource(ts, source, ["tasks", 0, "done"], true);
      expect(source.slice(toggle.start, toggle.end)).toBe("false");
      expect(toggle.text).toBe("true");
      const helper = editArtifactSource(
        ts,
        source,
        ["tasks", 0, "children", 0, "done"],
        false,
      );
      expect(helper.text).toBe('{ text: "Child", done: false }');
    });
  });
});

describe("Excalidraw figure theming", () => {
  it("maps Excalidraw's palette onto theme tokens", () => {
    expect(themeColor("#1e1e1e")).toBe("var(--spec-foreground)");
    expect(themeColor("#495057")).toBe("var(--spec-muted)");
    expect(themeColor("#ffffff")).toBe("var(--spec-background)");
    expect(themeColor("#fff")).toBe("var(--spec-background)");
    expect(themeColor("#e03131")).toBe("var(--vscode-charts-red, #e03131)");
    expect(themeColor("#1971c2")).toBe("var(--vscode-charts-blue, #1971c2)");
    expect(themeColor("#a5d8ff")).toBe(
      "color-mix(in srgb, var(--vscode-charts-blue, #a5d8ff) 30%, var(--spec-background))",
    );
    expect(themeColor("#b2f2bb")).toContain("--vscode-charts-green");
    expect(themeColor("#ffc9c9")).toContain("--vscode-charts-red");
    expect(themeColor("none")).toBeUndefined();
    expect(themeColor("url(#mask)")).toBeUndefined();
  });
});
