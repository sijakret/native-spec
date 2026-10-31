# Native Spec

Fast and durable specification modelling has become an essential building block in AI-native software development.

Spec-driven systems, however, often introduce drag or suffer from tooling and complexity.

Native Spec solves this by simply expressing your process, its artifacts, and relations directly in your native language tooling.

## Why Native Spec

Modeling your process within your native toolchain has a lot of benefits.

- **Checked traceability.** Native compiler checks & analysis catch missing required links and references to missing artifacts. No separate schema, parser, or custom format.
- **Next to no overhead.** Your editor, compiler, tests, and git are the spec infrastructure: autocomplete, go-to-definition, rename, and review all just work.
- **Zero Lock-in.** No additional vendors or tools required.
- **100% customizable.** Process definition & specification artifacts, relations, and constraints all live in git next to your implementation code - as code. Tailor it to your needs.
- **Tracked alongside your code in git.** Spec and implementation changes can trivially be correlated and reviewed together, ensuring consistency and traceability.
- **Process formalization.** As a side-effect of expressing your specifications in code, your process becomes explicit and formally represented, enabling better analysis and automation.
- **Fast hydration.** By expressing your spec natively it becomes trivial to hydrate. Analyzing it or imposing additional invariants becomes trivial. Forward-rendering your spec-graph into representations like markdown or HTML is also easy.
- **Integrations and utilities.** It is very easy to integrate custom views in your faviroute ide and create rich experiences when working with the spec as a human (see [example](skills/native-spec/examples/typescript/)).

Intuitively this should be some sort of optimum. Zero additional tooling is needed and programming language typically have very sharp and compact semantics to express data shapes & relations. It is probably very hard to achieve the same level of expressiveness and traceability with less ressources.

## TypeScript example

The [Acme Stockroom demo](skills/native-spec/examples/typescript/) defines user needs, requirements, and tests as TypeScript values, with app code linked through source comment annotations (see [full definition](skills/native-spec/examples/typescript/specs/definition/process.ts)). Additional fields and imports are omitted for illustration:

```ts
const manageStock = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Manage stock without overselling",
});
const orderLifecycle = artifact.softwareRequirement({
  id: "REQ-SR-002",
  title: "Reserve, fulfill, or cancel an order",
  acceptanceCriteria: [
    {
      id: "reserve-stock",
      description: "Open orders reserve stock without reducing on-hand stock.",
    },
  ],
});
const stockroomSuite = artifact.testCase({
  id: "TC-001",
  title: "Stock stays consistent through order transitions",
  code: ["tests/domain.test.ts"],
});

const orderLifecycleRelations = [
  derivesFrom(orderLifecycle, manageStock),
] as const;
const stockroomSuiteRelations = [
  verifies(stockroomSuite, orderLifecycle, "reserve-stock"),
] as const;
```

Each acceptance criterion has a stable local ID and must link to at least one test case; verifying one criterion does not cover the whole requirement.

Each artifact file exports its outgoing relations alongside the artifact. The artifact index explicitly collects both inventories; reusable constructors and validation rules stay in the process definition.

The [architecture overview](skills/native-spec/examples/typescript/specs/artifacts/architecture/000-architecture.ts) lives alongside the ABBs. Its main diagram describes the whole system and must contain every registered building block; every ABB also requires a summary diagram, shown on the architecture front page. Excalidraw and Mermaid are supported. The example uses editable Excalidraw SVGs, with visible ABB nodes checked against their actual embedded scenes, without generated intermediate files.

App files use `@specModule` header comments and `@spec` callable comments to name implementing ABBs. Requirement coverage follows the existing graph: code -> ABB -> requirements, with optional direct requirement refinements. Source analysis and artifact/process invariant tests live in `specs/audit/`; they validate links and declared ABB files without a handwritten ledger or generated intermediate files.

You can then also instantiate your spec for additional runtime checks or other processing:

```ts
// your live spec, checked for consistency already
export const project = defineProject({
  id: "acme-stockroom",
  title: "Acme Stockroom",
  overview: architectureOverview,
  artifacts,
  relations,
});
```

## Get Started

- [SKILL.md](skills/native-spec/SKILL.md) is the agent skill for bootstrapping greenfield and brownfield.
- [examples/typescript/](skills/native-spec/examples/typescript) is a working browser app, with an AST-based code-link audit and optional VS Code spec viewer.

```sh
cd skills/native-spec/examples/typescript
npm install
npm run dev          # app
npm test
npm run build        # checked static app
npm run specs:render -- markdown
npm run viewer:install   # optional: package and install the VS Code viewer
```
