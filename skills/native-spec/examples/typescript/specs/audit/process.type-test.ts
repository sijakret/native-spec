import {
  architectureDiagram,
  artifactFactory,
  defineProject,
  delivers,
  derivesFrom,
  implementsRequirement,
  verifies,
  type CodeBlock,
  type Implementation,
} from "../definition/process.js";
import type * as storage from "../../src/storage.js";
// @ts-expect-error module paths are checked by the native compiler
import type * as MissingSource from "../../src/missing-native-link.js";

// @ts-expect-error every diagram requires an explicit title
const untitledDiagram: CodeBlock = {
  language: "mermaid",
  source: "flowchart LR\nA-->B",
};

const artifact = artifactFactory("type-test");
const market = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Market",
  tags: ["test"],
  description: "Market need",
  acceptanceCriteria: [{ id: "accepted", description: "Accepted" }],
});
const software = artifact.softwareRequirement({
  id: "REQ-SR-001",
  title: "Software",
  tags: ["test"],
  description: "Software behavior",
  acceptanceCriteria: [
    { id: "accepted", description: "Accepted" },
    { id: "invalid-input", description: "Invalid input is rejected" },
  ],
});
const architecture = artifact.architectureBlock({
  id: "ABB-001",
  title: "Architecture",
  tags: ["test"],
  description: "Implementation boundary",
  summaryDiagram: {
    title: "Summary",
    language: "mermaid",
    source: "flowchart LR\nA-->B",
  },
  responsibilities: ["Implement behavior"],
});

const { summaryDiagram, ...withoutSummary } = architecture;
export type NativeStorageLinks = Implementation<
  typeof architecture,
  [
    typeof storage,
    typeof storage.importWorkspace,
    storage.WorkspaceStore["save"],
  ]
>;

// @ts-expect-error link owners must be architecture blocks
export type InvalidLinkOwner = Implementation<
  typeof software,
  [typeof storage]
>;

// @ts-expect-error a link must identify at least one source target
export type EmptyLinks = Implementation<typeof architecture, []>;

// @ts-expect-error method names are checked by the TypeScript compiler
export type MissingMethod = Implementation<
  typeof architecture,
  [storage.WorkspaceStore["missingMethod"]]
>;

// @ts-expect-error every building block requires its own summary diagram
artifact.architectureBlock(withoutSummary);

// @ts-expect-error architecture overview nodes must be architecture blocks
architectureDiagram({ title: "Overview", blocks: [software], connections: [] });

// @ts-expect-error an architecture diagram must contain at least one block
architectureDiagram({ title: "Empty overview", blocks: [], connections: [] });

architectureDiagram({
  title: "Overview",
  blocks: [architecture],
  // @ts-expect-error architecture connections cannot target requirements
  connections: [{ from: architecture, to: software, label: "Wrong target" }],
});

const test = artifact.testCase({
  id: "TC-001",
  title: "Test",
  type: "automated",
  code: ["tests/example.test.ts"],
  description: "Verification",
  steps: ["Run test"],
  expected: ["Passes"],
});
const sprint = artifact.sprint({
  id: "SPRINT-0001",
  title: "Sprint",
  status: "completed",
  description: "Delivery",
  tasks: [{ text: "Deliver", done: true }],
  architectureReview: [{ text: "No architecture impact", done: true }],
  documentationIntegrity: [{ text: "Specs updated", done: true }],
});

const relations = [
  derivesFrom(software, market),
  implementsRequirement(architecture, software),
  verifies(test, market, "accepted"),
  verifies(test, software, "accepted"),
  verifies(test, software, "invalid-input"),
  delivers(sprint, market),
  delivers(sprint, software),
  delivers(sprint, architecture),
  delivers(sprint, test),
] as const;

defineProject({
  id: "type-test",
  title: "Type Test",
  artifacts: [market, software, architecture, test, sprint],
  relations,
});

// @ts-expect-error every acceptance criterion must have a verification relation
defineProject({
  id: "type-test",
  title: "Missing Verification",
  artifacts: [market, software, architecture, test, sprint],
  relations: relations.filter((relation) => relation.kind !== "verifies"),
});

// @ts-expect-error only a test case can verify an acceptance criterion
verifies(sprint, software, "accepted");

// @ts-expect-error a requirement alone is not a verification target
verifies(test, software);

// @ts-expect-error criterion IDs are checked against the selected requirement
verifies(test, software, "unknown");

// @ts-expect-error another requirement's criterion is not available here
verifies(test, market, "invalid-input");

// @ts-expect-error covering one criterion does not cover the whole requirement
defineProject({
  id: "type-test",
  title: "Partial Verification",
  artifacts: [market, software, architecture, test, sprint],
  relations: [
    ...relations.filter((relation) => relation.kind !== "verifies"),
    verifies(test, market, "accepted"),
    verifies(test, software, "accepted"),
  ],
});

// @ts-expect-error IDs follow the typed pattern
artifact.testCase({ ...test, id: "TC-1" });

// @ts-expect-error manually authored relations must reference a declared criterion
defineProject({
  id: "type-test",
  title: "Unknown Criterion",
  artifacts: [market, software, architecture, test, sprint],
  relations: [
    ...relations,
    {
      ...verifies(test, software, "accepted"),
      to: { ...software, criterion: "unknown" },
    },
  ],
});
