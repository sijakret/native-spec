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

If the model has architecture blocks, keep a required architecture overview with a whole-system diagram that includes every registered block, including isolated blocks and build-time tooling, and give each block a summary diagram that depicts it. Prefer editable diagram sources whose block nodes carry a structured reference (project, kind, ID) and a visible ID label, and have the existing check/build audit inspect the actual diagram content: missing, hidden, duplicate, or foreign nodes fail. Do not count ID mentions in arbitrary text or generate intermediate diagram files. Be explicit about which guarantees the compiler provides and which the audit provides.

For code traceability, link implementation code to architecture blocks with native symbol references that the compiler and editor already check; avoid comment IDs, runtime annotation calls, handwritten ledgers, generated intermediates, and custom editor validation workers. Declare links beside their block, keep them out of production output, and cover private code without widening its visibility where the language allows. Add an independent build-time audit that enumerates the source tree, resolves links to actual symbols, requires complete ownership, and derives requirement coverage through implementation relations (code → block → requirements). Reserve plain file paths for assets without addressable symbols. Keep coverage audits and artifact/process invariant tests together in a dedicated spec audit folder.

The [TypeScript guide](./examples/typescript/README.md) shows one realization: Excalidraw/Mermaid overviews and summaries, erased `Implementation` links, uniform `Bindings` contracts for exported and private symbols, reusable callable/constructor constraints, and the coverage audit.

- **Greenfield:** define needs, then requirements, architecture, tests, and risks as design emerges. Keep the first sprint planned until implemented.
- **Brownfield:** document current behavior using existing modules and real test paths; add requirements, constraints, and mitigated risks. Use one completed baseline sprint if the model includes sprints.
- **Changes:** update affected artifacts and inventory, plan delivery and verification, declare relations, then check specs before implementation. Keep specs current and finish with checks/tests; update definitions, tests, and views together when changing the model. Add concise, model-specific instructions to `AGENTS.md` or `.github/copilot-instructions.md` if useful.
