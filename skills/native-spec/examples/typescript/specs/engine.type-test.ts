import {
  artifactFactory,
  defineProject,
  delivers,
  derivesFrom,
  implementsRequirement,
  verifies,
} from "./definition/engine.js";

const artifact = artifactFactory("type-test");
const market = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Market",
  tags: ["test"],
  description: "Market need",
  acceptanceCriteria: ["Accepted"],
});
const software = artifact.softwareRequirement({
  id: "REQ-SR-001",
  title: "Software",
  tags: ["test"],
  description: "Software behavior",
  acceptanceCriteria: ["Accepted"],
});
const architecture = artifact.architectureBlock({
  id: "ABB-001",
  title: "Architecture",
  tags: ["test"],
  description: "Implementation boundary",
  responsibilities: ["Implement behavior"],
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
  verifies(test, market),
  verifies(test, software),
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

// @ts-expect-error every requirement must have a verification relation
defineProject({
  id: "type-test",
  title: "Missing Verification",
  artifacts: [market, software, architecture, test, sprint],
  relations: relations.filter((relation) => relation.kind !== "verifies"),
});

// @ts-expect-error only a test case can verify a requirement
verifies(sprint, software);

// @ts-expect-error IDs follow the typed pattern
artifact.testCase({ ...test, id: "TC-1" });
