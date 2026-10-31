---
name: native-spec
description: Bootstrap and maintain a Native Spec using a repository's native language and tooling — project-specific artifacts such as requirements, architecture, tests, risks, and sprints as code with checked traceability. Use for greenfield or brownfield spec setup, tailoring the process model, adding/changing spec artifacts or relations, the spec-first change workflow, and adapting Native Spec to another ecosystem.
---

# Native Spec

Keep project specifications as native code beside implementation. Reuse the project's compiler, tests, editor, and git; avoid a separate spec toolchain or hand-maintained rendered mirrors.

## Choose a Model

The bundled Stockroom app is an example, not a required process. Tailor its kinds (market/software/non-functional requirements, architecture blocks, tests, risks, and sprints), fields, relations, and checks to project needs. Example relations are `derivesFrom(SR, MR)`, `implementsRequirement(ABB, SR | NFR)`, `verifies(TC, requirement, criterionId)`, `verifies(TC, risk)`, `threatens(RISK, requirement)`, and `delivers(SPRINT, non-sprint)`. Requirements have acceptance criteria with stable, locally unique IDs and descriptions; every criterion must link to at least one test case, rather than treating a whole requirement as verified by one link. Adapt or replace these coverage rules when tailoring the model.

## Bootstrap

1. Choose the model and identify the repository's language, build system, and test runner. For TypeScript, tailor the [example guide](./examples/typescript/README.md) and [runnable example](./examples/typescript/); otherwise use native tooling.
2. Give artifacts stable IDs and native fields; keep an explicit inventory and declare each directed relation once. Add checks for valid endpoints, project membership, duplicates, and model-specific coverage or completion; test valid and invalid cases, without promising unsupported compile-time guarantees.
3. Populate specs, run checks and tests, and generate views only when useful.

## Populate and Change

Keep reusable model definitions separate from project instances. Declare each directed relation beside its source artifact and explicitly collect the artifact and relation inventories for project assembly. Import relation targets directly from their owning modules, not through the collecting index; extract shared references into a dependency-free module when needed to avoid cycles.

The TypeScript example requires `specs/artifacts/architecture/000-architecture.ts` with a whole-system diagram and every ABB requires its own `summaryDiagram`, shown beneath its introduction on the architecture front page. Excalidraw and Mermaid are supported; the example currently uses editable Excalidraw SVG sidecars for the system and summaries. `architectureFigure(figure(...), [actualAbbs])` declares an Excalidraw overview; `architectureDiagram` renders a Mermaid overview in memory. Include every registered ABB, including isolated blocks and build-time tooling. The audit inspects actual Excalidraw scenes and visible SVG labels: ABB shapes carry `customData.nativeSpec` with project, kind, and ID, and a visible bound label containing that ID. A summary must depict its owner. Missing, hidden, duplicate, or foreign nodes fail the existing check/build audit and editor overview validation. TypeScript checks required summaries and reference kinds, not complete scene coverage. Do not substitute ID mentions in arbitrary text or generate an intermediate diagram file.

For code traceability, keep annotations beside implementation and analyze source directly; avoid handwritten link ledgers and generated intermediate files. The TypeScript example uses `@specModule` file headers and `@spec` callable comments naming implementing ABBs, with AST extraction and CSS comment parsing. Derive requirements through the ABBs' implementation relations; allow optional direct requirement refinements without replacing ABB ownership. Cross-check declared ABB file lists against source annotations, and group code audits and artifact/process invariant tests under `specs/audit/`.

Author ABB summary figures as square compositions beside their introductions, capped at 30% of the row and 240px, including in narrow editors. Do not stack them beneath the text. Use standard organic Excalidraw strokes by default (`roughness: 1`, `strokeWidth: 2`) and export through Excalidraw to keep the visible SVG and editable scene consistent. Whole-system diagrams keep their natural aspect ratio.

- **Greenfield:** define needs, then requirements, architecture, tests, and risks as design emerges. Keep the first sprint planned until implemented.
- **Brownfield:** document current behavior using existing modules and real test paths; add requirements, constraints, and mitigated risks. Use one completed baseline sprint if the model includes sprints.
- **Changes:** update affected artifacts and inventory, plan delivery and verification, declare relations, then check specs before implementation. Keep specs current and finish with checks/tests; update definitions, tests, and views together when changing the model. Add concise, model-specific instructions to `AGENTS.md` or `.github/copilot-instructions.md` if useful.
