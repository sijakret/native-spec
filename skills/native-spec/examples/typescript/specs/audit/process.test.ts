import { existsSync, readFileSync, readdirSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  architectureDiagram,
  artifactFactory,
  artifactKey,
  buildGraph,
  figure,
  figureParts,
  figureToken,
  isFigure,
  testedBy,
  validateProject,
  verifies,
  type ArtifactKind,
  type CodeBlock,
  type SpecProject,
} from "../definition/process.js";
import {
  browserStorage,
  codeTraceabilityAudit,
  inventory,
  inventoryDesk,
  orderLifecycle,
  orderStates,
  stockDomain,
} from "../artifacts/index.js";
import { architectureOverview } from "../artifacts/architecture/000-architecture.js";
import project from "../definition/project.js";
import { renderHtml } from "../utils/output/html.js";
import { renderMarkdown } from "../utils/output/markdown.js";
import {
  auditExcalidraw,
  validateArchitectureFigures,
} from "./architecture-audit.js";

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

  it.each(
    project.artifacts.filter(
      (artifact) => artifact.kind === "architecture-block",
    ),
  )("requires a summary diagram for $id", (block) => {
    expect(
      validateProject({
        ...project,
        artifacts: project.artifacts.map((artifact) =>
          artifact === block
            ? { ...artifact, summaryDiagram: undefined }
            : artifact,
        ),
      } as unknown as SpecProject),
    ).toContain(`Summary diagram is required: ${artifactKey(block)}`);
  });

  it("requires an architecture overview diagram when the project has ABBs", () => {
    expect(
      validateProject({
        ...project,
        overview: { description: "Overview without an architecture diagram" },
      }),
    ).toContain("Architecture overview diagram is required.");
  });

  describe("architecture overview", () => {
    const diagram = architectureDiagram({
      title: "Architecture overview",
      blocks: [
        stockDomain,
        browserStorage,
        inventoryDesk,
        codeTraceabilityAudit,
      ],
      connections: [],
    });
    const withDiagrams = (
      ...diagrams: [typeof diagram, ...(typeof diagram)[]]
    ) => ({
      ...project,
      overview: { ...architectureOverview, diagrams },
    });

    it("uses the required overview module and renders every block, including isolated ones", () => {
      expect(project.overview).toBe(architectureOverview);
      const isolated = architectureDiagram({ ...diagram, connections: [] });
      expect(validateProject(withDiagrams(isolated))).toEqual([]);
      for (const block of diagram.blocks)
        expect(isolated.source).toContain(
          `${block.id.replaceAll("-", "_")}["${block.id} - ${block.title}"]`,
        );
    });

    it.each(diagram.blocks)("rejects an overview missing $id", (missing) => {
      const remaining = diagram.blocks.filter(
        (block) => block.id !== missing.id,
      );
      const incomplete = architectureDiagram({
        ...diagram,
        blocks: [remaining[0]!, ...remaining.slice(1)],
        connections: [],
      });
      expect(validateProject(withDiagrams(incomplete))).toEqual([
        `Missing architecture overview block: ${artifactKey(missing)}`,
      ]);
    });

    it("requires an overview update when another ABB is registered", () => {
      const additional = { ...diagram.blocks[0], id: "ABB-005" } as const;
      expect(
        validateProject({
          ...project,
          artifacts: [...project.artifacts, additional],
        }),
      ).toEqual([
        "Missing architecture overview block: architecture-block:ABB-005",
      ]);
    });

    it("does not count ABB IDs in plain Mermaid text as declared diagram nodes", () => {
      expect(
        validateProject({
          ...project,
          overview: {
            description: "Uncheckable diagram",
            diagrams: [
              {
                title: "Names only",
                language: "mermaid",
                source: `flowchart LR\n%% ${diagram.blocks.map((block) => block.id).join(" ")}`,
              },
            ],
          },
        }),
      ).toContain("Architecture overview diagram is required.");
      expect(validateProject({ ...project, overview: undefined })).toContain(
        "Architecture overview diagram is required.",
      );
    });

    it("requires a single diagram to cover every ABB rather than partial diagrams together", () => {
      const first = architectureDiagram({
        ...diagram,
        blocks: [diagram.blocks[0], diagram.blocks[1]],
        connections: [],
      });
      const second = architectureDiagram({
        ...diagram,
        blocks: [diagram.blocks[2], diagram.blocks[3]],
        connections: [],
      });
      expect(validateProject(withDiagrams(first, second))).toEqual([
        "Missing architecture overview block: architecture-block:ABB-003",
        "Missing architecture overview block: architecture-block:ABB-004",
        "Missing architecture overview block: architecture-block:ABB-001",
        "Missing architecture overview block: architecture-block:ABB-002",
      ]);
    });

    it("rejects duplicate, unknown, and foreign-project nodes", () => {
      const first = diagram.blocks[0];
      for (const [extra, expected] of [
        [first, `Duplicate architecture overview block: ${artifactKey(first)}`],
        [
          { ...first, id: "ABB-999" } as const,
          "Unknown architecture overview block: acme-stockroom:architecture-block:ABB-999",
        ],
        [
          { ...first, project: "foreign" },
          `Unknown architecture overview block: foreign:${artifactKey(first)}`,
        ],
      ] as const) {
        const invalid = architectureDiagram({
          ...diagram,
          blocks: [...diagram.blocks, extra],
        });
        expect(validateProject(withDiagrams(invalid))).toContain(expected);
      }
    });

    it("rejects connections to nodes outside the declared diagram", () => {
      const outside = { ...diagram.blocks[0], id: "ABB-999" } as const;
      const invalid = architectureDiagram({
        ...diagram,
        connections: [
          { from: diagram.blocks[0], to: outside, label: "Missing node" },
        ],
      });
      expect(validateProject(withDiagrams(invalid))).toEqual([
        "Architecture overview connection references an undeclared block: acme-stockroom:architecture-block:ABB-999",
      ]);
    });

    it("rejects stale titles and Mermaid source detached from its declared nodes", () => {
      const stale = architectureDiagram({
        ...diagram,
        blocks: [
          { ...diagram.blocks[0], title: "Old title" },
          ...diagram.blocks.slice(1),
        ],
      });
      expect(validateProject(withDiagrams(stale))).toContain(
        "Stale architecture overview block title: architecture-block:ABB-001",
      );
      expect(
        validateProject(
          withDiagrams({
            ...diagram,
            source: "flowchart LR\n  Unrelated[Unrelated]",
          }),
        ),
      ).toContain(
        "Architecture overview diagram source does not match its blocks and connections: Architecture overview",
      );
    });

    it("escapes labels without changing the Mermaid node structure", () => {
      const block = { ...diagram.blocks[0], title: 'Stock "A" & <B>\nnext' };
      const escaped = architectureDiagram({
        title: "Escaped labels",
        blocks: [block],
        connections: [
          { from: block, to: block, label: 'Load "stock"', dashed: true },
        ],
      });
      expect(escaped.source).toBe(
        'flowchart LR\n  ABB_001["ABB-001 - Stock #34;A#34; #38; #60;B#62; next"]\n  ABB_001 -.->|"Load #34;stock#34;"| ABB_001',
      );
    });
  });

  it("collects outgoing relations declared alongside their source artifacts", async () => {
    const inventoryModule =
      await import("../artifacts/requirements/001-inventory.sr.js");
    const ordersModule =
      await import("../artifacts/requirements/002-order-lifecycle.sr.js");

    for (const [module, artifact, name] of [
      [inventoryModule, inventory, "inventoryRelations"],
      [ordersModule, orderLifecycle, "orderLifecycleRelations"],
    ] as const) {
      expect(module).toHaveProperty(
        name,
        project.relations.filter(
          (relation) => artifactKey(relation.from) === artifactKey(artifact),
        ),
      );
    }
  });

  it("accepts native criterion references without duplicate artifact relations and still validates legacy edges", () => {
    const artifact = artifactFactory("criteria");
    const requirement = artifact.softwareRequirement({
      id: "REQ-SR-001",
      title: "Stock",
      tags: ["stock"],
      description: "Keep stock valid",
      acceptanceCriteria: [
        {
          id: "non-negative-stock",
          description: "Stock cannot become negative",
          tests: testedBy<[() => void]>(),
        },
        {
          id: "whole-quantities",
          description: "Quantities must be whole numbers",
          tests: testedBy<[() => void]>(),
        },
      ],
    });
    const test = artifact.testCase({
      id: "TC-001",
      title: "Stock validation",
      type: "automated",
      code: ["tests/stock.test.ts"],
      description: "Reject invalid stock",
      steps: ["Apply invalid quantities"],
      expected: ["Stock stays valid"],
    });
    const example = {
      id: "criteria",
      title: "Criterion coverage",
      artifacts: [requirement, test],
      relations: [],
    };
    expect(validateProject(example)).toEqual([]);
    const first = verifies(test, requirement, "non-negative-stock");
    expect(validateProject({ ...example, relations: [first] })).toEqual([]);
    const covered = {
      ...example,
      relations: [first, verifies(test, requirement, "whole-quantities")],
    };
    expect(validateProject(covered)).toEqual([]);
    expect(
      validateProject({
        ...covered,
        relations: [...covered.relations, first],
      }),
    ).toEqual([
      "Duplicate relation: verifies:test-case:TC-001:software-requirement:REQ-SR-001:non-negative-stock",
    ]);
    expect(
      validateProject({
        ...covered,
        relations: [
          ...covered.relations,
          { ...first, to: { ...first.to, criterion: "unknown" } },
        ],
      }),
    ).toEqual([
      "Missing acceptance criterion: software-requirement:REQ-SR-001:unknown",
    ]);
    expect(
      validateProject({
        ...example,
        relations: [{ ...first, to: requirement }],
      } as unknown as SpecProject),
    ).toEqual([
      "Verification must target an acceptance criterion: software-requirement:REQ-SR-001",
    ]);
    expect(
      validateProject({
        ...covered,
        relations: [
          { ...first, from: { ...first.from, id: "TC-002" } },
          covered.relations[1]!,
        ],
      }),
    ).toEqual(["Missing relation source: test-case:TC-002"]);
  });

  it("requires criterion references even for untyped runtime input, without a test-case artifact", () => {
    const acceptanceCriteria = inventory.acceptanceCriteria.map(
      ({ tests, ...criterion }) => criterion,
    );
    expect(
      validateProject({
        id: project.id,
        title: "Missing native references",
        artifacts: [{ ...inventory, acceptanceCriteria }],
        relations: [],
      } as unknown as SpecProject),
    ).toEqual(
      inventory.acceptanceCriteria.map(
        (criterion) =>
          `Acceptance criterion tests are required: software-requirement:${inventory.id}:${criterion.id}`,
      ),
    );
  });

  it("rejects invalid and duplicate criterion definitions", () => {
    const artifact = {
      ...inventory,
      acceptanceCriteria: [
        { id: "bad id", description: "", tests: testedBy<[() => void]>() },
        {
          id: "bad id",
          description: "Duplicate",
          tests: testedBy<[() => void]>(),
        },
      ] as const,
    };
    expect(
      validateProject({
        ...project,
        overview: undefined,
        artifacts: [artifact],
        relations: [],
      }),
    ).toEqual([
      "Invalid acceptance criterion ID: software-requirement:REQ-SR-001:bad id",
      "Acceptance criterion description is required: software-requirement:REQ-SR-001:bad id",
      "Invalid acceptance criterion ID: software-requirement:REQ-SR-001:bad id",
      "Duplicate acceptance criterion: software-requirement:REQ-SR-001:bad id",
    ]);
  });

  it("names each artifact file <ID number>-<slug>.<kind>.ts", () => {
    const files = readdirSync(join(import.meta.dirname, "../artifacts"), {
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
      "implements",
      "delivers",
    ]);
    expect(
      graph.incoming
        .get(key)
        ?.flatMap((relation) =>
          relation.kind === "verifies" && relation.to.kind !== "risk"
            ? [relation.to.criterion]
            : [],
        ),
    ).toEqual([]);
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
    expect(renderMarkdown(project)).toContain("## Software Requirements");
    expect(
      project.artifacts.some(
        (artifact) => String(artifact.kind) === "test-case",
      ),
    ).toBe(false);
    expect(
      project.relations.some(
        (relation) => String(relation.kind) === "verifies",
      ),
    ).toBe(false);
    expect(validateProject(project)).toEqual([]);
    expect(renderHtml(project)).toContain('<article id="req-sr-001">');
  });

  it("renders verification links at criterion granularity", () => {
    const testInventory = [
      {
        kind: "test" as const,
        file: "tests/domain.test.ts",
        symbol: "seededInventory",
        line: 20,
        column: 1,
        endLine: 30,
        verifications: [{ requirement: inventory.id, criterion: "search" }],
      },
    ];
    const html = renderHtml(project, { testInventory });
    expect(html).toMatch(
      /<li class="criterion-item" id="req-sr-001-ac-search">.*aria-label="Tests for search".*data-code-file="tests\/domain.test.ts"/,
    );
    expect(html).not.toMatch(
      /<li id="req-sr-001-ac-availability">.*Tested by:/,
    );
    expect(html).not.toContain('aria-label="Tests for availability"');
    expect(html).toContain('data-path="acceptanceCriteria.0.description"');
    expect(html).toContain('data-source-path="acceptanceCriteria.0.id"');
    const markdown = renderMarkdown(project, { testInventory });
    expect(markdown).toContain(
      '<a id="req-sr-001-ac-search"></a>\n\n- **search:**',
    );
    expect(markdown).toContain(
      "- **search:** Search matches product names and SKUs without case sensitivity. (Tests: [Test: seededInventory](<tests/domain.test.ts#L20>))",
    );
    expect(markdown).not.toContain("TC-001");
  });

  it("renders intended uses in Markdown and escapes them in HTML", () => {
    const example = {
      ...project,
      overview: {
        description: "Stock desk",
        intendedUses: ['Receive <stock> & "orders"', "Back up the workspace"],
      },
    };
    const html = renderHtml(example);
    const markdown = renderMarkdown(example);
    expect(html).toContain(
      '<h2 id="spec-intended-uses-title">Intended uses</h2>',
    );
    expect(html).toContain(
      "<li>Receive &lt;stock&gt; &amp; &quot;orders&quot;</li>",
    );
    expect(html).toContain("<li>Back up the workspace</li>");
    expect(html).not.toContain("<stock>");
    expect(markdown).toContain(
      '## Intended uses\n\n- Receive <stock> & "orders"\n- Back up the workspace\n',
    );
  });

  it("omits intended uses when the overview or list is absent or empty", () => {
    const minimal = {
      id: "minimal",
      title: "Minimal",
      artifacts: [],
      relations: [],
    };
    for (const example of [
      minimal,
      { ...minimal, overview: { description: "Stock desk" } },
      { ...minimal, overview: { description: "Stock desk", intendedUses: [] } },
    ]) {
      expect(renderHtml(example)).not.toContain("Intended uses");
      expect(renderMarkdown(example)).not.toContain("Intended uses");
    }
  });

  it.each(["", " \t\n"])(
    "rejects blank diagram titles (%j) in overview and artifacts",
    (title) => {
      const sprint = artifactFactory("titles").sprint({
        id: "SPRINT-0001",
        title: "Delivery",
        status: "planned",
        description: "Diagram validation",
        diagrams: [
          { title, language: "mermaid", source: "flowchart LR\nA-->B" },
        ],
        tasks: [{ text: "Implement", done: false }],
        architectureReview: [{ text: "Review", done: false }],
        documentationIntegrity: [{ text: "Document", done: false }],
      });
      expect(
        validateProject({
          id: "titles",
          title: "Diagram titles",
          overview: { description: "Context", diagrams: sprint.diagrams },
          artifacts: [sprint],
          relations: [],
        }),
      ).toEqual([
        "Diagram title is required: project:titles.diagrams[0]",
        "Diagram title is required: sprint:SPRINT-0001.diagrams[0]",
      ]);
    },
  );

  it("reports missing diagram titles loaded without type checking", () => {
    const diagram: CodeBlock = JSON.parse(
      '{"language":"mermaid","source":"flowchart LR\\nA-->B"}',
    );
    expect(
      validateProject({
        id: "titles",
        title: "Diagram titles",
        overview: { description: "Context", diagrams: [diagram] },
        artifacts: [],
        relations: [],
      }),
    ).toEqual(["Diagram title is required: project:titles.diagrams[0]"]);
  });

  it("renders diagram titles in HTML and Markdown", () => {
    const html = renderHtml(project);
    const markdown = renderMarkdown(project);
    const titles = [
      "Architecture overview",
      "Stock and order domain summary",
      "Order reservation states",
      "Browser storage summary",
      "Persistence boundary",
      "Inventory desk summary",
      "Runtime boundaries",
      "Code traceability audit summary",
      "Traceability boundaries",
      "Reserve and persist an order",
    ];
    const captions = [
      ...html.matchAll(
        /<figcaption>(?:<span[^>]*>)?([^<]*)(?:<\/span>)?<\/figcaption>/g,
      ),
    ].map((match) => match[1]);
    expect(captions).toEqual(titles);
    const figures = [
      architectureOverview.diagrams[0],
      orderStates,
      ...project.artifacts
        .filter((artifact) => artifact.kind === "architecture-block")
        .map((block) => block.summaryDiagram)
        .filter(isFigure),
    ];
    for (const title of titles.filter(
      (title) => !figures.some((figure) => figure.title === title),
    )) {
      expect(markdown).toContain(`**${title}**\n\n\`\`\`mermaid`);
    }
    for (const figure of figures)
      expect(markdown).toContain(`**${figure.title}**\n\n${figure.image}`);
  });

  describe("Excalidraw figures", () => {
    const moduleUrl =
      "file:///repo/specs/artifacts/architecture/001-stock-domain.abb.ts";
    const main = architectureOverview.diagrams[0];
    const source = readFileSync(new URL(main.excalidraw), "utf8");
    const changedScene = (
      mutate: (elements: Record<string, unknown>[]) => void,
    ): string => {
      const payloadText = source.match(
        /<!-- payload-start -->([\s\S]*?)<!-- payload-end -->/,
      )![1]!;
      const payload = JSON.parse(
        Buffer.from(payloadText, "base64").toString("latin1"),
      );
      const scene = JSON.parse(
        inflateSync(Buffer.from(payload.encoded, "latin1")).toString("utf8"),
      );
      mutate(scene.elements);
      payload.encoded = deflateSync(
        Buffer.from(JSON.stringify(scene)),
      ).toString("latin1");
      return source.replace(
        payloadText,
        Buffer.from(JSON.stringify(payload), "latin1").toString("base64"),
      );
    };

    it("checks the system drawing and all four editable summary drawings", () => {
      expect(validateArchitectureFigures(project)).toEqual([]);
      expect(auditExcalidraw(source, main.blocks)).toEqual([]);
    });

    it.each(main.blocks)(
      "rejects deleting $id from the actual system scene",
      (block) => {
        const changed = changedScene((elements) => {
          elements.find((element) => element.id === block.id)!.isDeleted = true;
        });
        expect(auditExcalidraw(changed, main.blocks)).toContain(
          `Missing Excalidraw ABB node: ${block.id}`,
        );
      },
    );

    it("rejects invisible scene nodes and labels that exist only in metadata", () => {
      const hidden = changedScene((elements) => {
        elements.find((element) => element.id === "ABB-001")!.opacity = 0;
      });
      expect(auditExcalidraw(hidden, main.blocks)).toContain(
        "Missing Excalidraw ABB node: ABB-001",
      );
      const unlabeled = changedScene((elements) => {
        elements.find((element) => element.id === "ABB-001")!.boundElements =
          [];
      });
      expect(auditExcalidraw(unlabeled, main.blocks)).toContain(
        "Excalidraw ABB node must have a visible bound label: ABB-001",
      );
      expect(
        auditExcalidraw(
          source.replaceAll("<text ", '<text display="none" '),
          main.blocks,
        ),
      ).toContain("Missing Excalidraw ABB node: ABB-001");
    });

    it("rejects duplicate and foreign ABB references in the drawing", () => {
      const duplicate = changedScene((elements) => {
        elements.push({
          ...elements.find((element) => element.id === "ABB-001"),
          id: "duplicate",
        });
      });
      expect(auditExcalidraw(duplicate, main.blocks)).toContain(
        "Duplicate Excalidraw ABB node: ABB-001",
      );
      const foreign = changedScene((elements) => {
        elements.find((element) => element.id === "ABB-001")!.customData = {
          nativeSpec: {
            project: "foreign",
            kind: "architecture-block",
            id: "ABB-001",
          },
        };
      });
      expect(auditExcalidraw(foreign, main.blocks)).toContain(
        "Unknown Excalidraw ABB node: foreign:ABB-001",
      );
    });

    it("rejects plain SVGs without an editable scene and summaries for the wrong ABB", () => {
      expect(
        auditExcalidraw(
          '<svg xmlns="http://www.w3.org/2000/svg"><text>ABB-001</text></svg>',
          [stockDomain],
        ),
      ).toContain(
        "Invalid Excalidraw figure: Missing editable Excalidraw scene.",
      );
      if (!isFigure(browserStorage.summaryDiagram))
        throw new Error("Expected the Excalidraw summary fixture.");
      const wrongSummary = readFileSync(
        new URL(browserStorage.summaryDiagram.excalidraw),
        "utf8",
      );
      expect(
        auditExcalidraw(wrongSummary, [stockDomain], main.blocks),
      ).toContain("Missing Excalidraw ABB node: ABB-001");
    });

    it("keeps Mermaid summaries supported and rejects empty Mermaid summaries", () => {
      const summary = {
        title: "Domain summary",
        language: "mermaid",
        source: "flowchart LR\nCommand-->Domain-->Workspace",
      } as const;
      const example = {
        ...project,
        artifacts: project.artifacts.map((artifact) =>
          artifact === stockDomain
            ? { ...stockDomain, summaryDiagram: summary }
            : artifact,
        ),
      };
      expect(validateProject(example)).toEqual([]);
      expect(validateArchitectureFigures(example)).toEqual([]);
      expect(
        validateProject({
          ...example,
          artifacts: example.artifacts.map((artifact) =>
            artifact.kind === "architecture-block" &&
            artifact.id === stockDomain.id
              ? { ...artifact, summaryDiagram: { ...summary, source: " " } }
              : artifact,
          ),
        }),
      ).toContain(
        "Summary diagram must be Excalidraw or nonempty Mermaid: architecture-block:ABB-001",
      );
    });

    it("derives the sidecar next to its module", () => {
      const sketch = figure(moduleUrl, 2, "Stock [draft]");
      expect(sketch.excalidraw).toBe(
        "file:///repo/specs/artifacts/architecture/figures/001-stock-domain.abb.figure-002.excalidraw.svg",
      );
      expect(sketch.ref).toBe(`[Stock \\[draft\\]](<${sketch.excalidraw}>)`);
      expect(sketch.image).toBe(`![Stock \\[draft\\]](<${sketch.excalidraw}>)`);
      expect(isFigure(sketch)).toBe(true);
      expect(() => figure(moduleUrl, 0, "Zero")).toThrow("1-999");
      expect(() => figure(moduleUrl, 1, " ")).toThrow("title is required");
    });

    it("splits text into plain runs, references, and embeds", () => {
      const sketch = figure(moduleUrl, 1, "Stock [draft]");
      expect(figureParts(`See ${sketch.ref}, then ${sketch.image}.`)).toEqual([
        "See ",
        { embed: false, title: "Stock [draft]", excalidraw: sketch.excalidraw },
        ", then ",
        { embed: true, title: "Stock [draft]", excalidraw: sketch.excalidraw },
        ".",
      ]);
      expect(figureParts("Plain [link](<https://example.com/a.svg>)")).toEqual([
        "Plain [link](<https://example.com/a.svg>)",
      ]);
    });

    it("renders captioned, referenced, and embedded figures", () => {
      const sketch = figure(moduleUrl, 1, "Flow <v2>");
      const abb = artifactFactory("figures").architectureBlock({
        id: "ABB-001",
        title: "Figures",
        tags: ["figures"],
        description: `Follows ${sketch.ref}.`,
        summaryDiagram: sketch,
        diagrams: [sketch],
        responsibilities: [`Draw ${sketch.image}`],
      });
      const example = {
        id: "figures",
        title: "Figures",
        artifacts: [abb],
        relations: [],
      };
      const html = renderHtml(example);
      expect(html).toContain(
        `<span class="excalidraw-figure" data-excalidraw="${sketch.excalidraw}" data-title="Flow &lt;v2&gt;"><img src="${sketch.excalidraw}" alt="Flow &lt;v2&gt;"></span>`,
      );
      expect(html).toContain(
        `<p data-source-path="description">Follows <a class="figure-ref" href="${sketch.excalidraw}" data-excalidraw="${sketch.excalidraw}">Flow &lt;v2&gt;</a>.</p>`,
      );
      expect(html).toContain(
        '<li data-source-path="responsibilities.0">Draw <span class="excalidraw-figure"',
      );
      expect(html).not.toContain("](<");

      const relative = (url: string) =>
        url.replace("file:///repo/specs/", "../");
      const exported = renderHtml(example, { figureHref: relative });
      expect(exported).toContain(
        'src="../artifacts/architecture/figures/001-stock-domain.abb.figure-001.excalidraw.svg"',
      );
      expect(exported).toContain(
        'href="../artifacts/architecture/figures/001-stock-domain.abb.figure-001.excalidraw.svg"',
      );
      expect(exported).toContain(`data-excalidraw="${sketch.excalidraw}"`);

      const markdown = renderMarkdown(example, { figureHref: relative });
      expect(markdown).toContain(
        "Follows [Flow <v2>](<../artifacts/architecture/figures/001-stock-domain.abb.figure-001.excalidraw.svg>).",
      );
      expect(markdown).toContain("- Draw ![Flow <v2>](<../artifacts/");
      expect(markdown).toContain(
        "**Flow <v2>**\n\n![Flow <v2>](<../artifacts/",
      );
    });

    it("rejects diagram figures that do not point at an .excalidraw.svg", () => {
      expect(
        validateProject({
          id: "figures",
          title: "Figures",
          overview: {
            description: "Context",
            diagrams: [{ ...orderStates, excalidraw: "file:///x.svg" }],
          },
          artifacts: [],
          relations: [],
        }),
      ).toEqual([
        "Figure must reference a .excalidraw.svg file: project:figures.diagrams[0]",
      ]);
    });

    it("has a sidecar file for every figure the project references", () => {
      const urls = new Set<string>();
      const visit = (value: unknown): void => {
        if (typeof value === "string")
          for (const match of value.matchAll(figureToken)) urls.add(match[3]!);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") {
          if ("excalidraw" in value) urls.add(String(value.excalidraw));
          Object.values(value).forEach(visit);
        }
      };
      visit(project);
      expect(urls.size).toBeGreaterThan(0);
      for (const url of urls)
        expect(existsSync(fileURLToPath(url)), url).toBe(true);
    });
  });
});
