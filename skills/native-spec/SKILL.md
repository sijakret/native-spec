---
name: native-spec
description: Bootstrap and maintain a Native Spec using a repository's native language and tooling — project-specific artifacts such as requirements, architecture, tests, risks, and sprints as code with checked traceability. Use for greenfield or brownfield spec setup, tailoring the process model, adding/changing spec artifacts or relations, the spec-first change workflow, and adapting Native Spec to another ecosystem.
---

# Native Spec

Keep project specifications as native code beside implementation. Reuse the project's compiler, tests, editor, and git; avoid a separate spec toolchain or hand-maintained rendered mirrors.

## Choose a Model

The bundled notes app is an example, not a required process. Tailor its kinds (market/software/non-functional requirements, architecture blocks, tests, risks, and sprints), fields, relations, and checks to project needs. Example relations are `derivesFrom(SR, MR)`, `implementsRequirement(ABB, SR | NFR)`, `verifies(TC, requirement | risk)`, `threatens(RISK, requirement)`, and `delivers(SPRINT, non-sprint)`. Adapt or replace its coverage rules.

## Bootstrap

1. Choose the model and identify the repository's language, build system, and test runner. For TypeScript, tailor the [example guide](./examples/typescript/README.md) and [runnable example](./examples/typescript/); otherwise use native tooling.
2. Give artifacts stable IDs and native fields; keep an explicit inventory and declare each directed relation once. Add checks for valid endpoints, project membership, duplicates, and model-specific coverage or completion; test valid and invalid cases, without promising unsupported compile-time guarantees.
3. Populate specs, run checks and tests, and generate views only when useful.

## Populate and Change

- **Greenfield:** define needs, then requirements, architecture, tests, and risks as design emerges. Keep the first sprint planned until implemented.
- **Brownfield:** document current behavior using existing modules and real test paths; add requirements, constraints, and mitigated risks. Use one completed baseline sprint if the model includes sprints.
- **Changes:** update affected artifacts and inventory, plan delivery and verification, declare relations, then check specs before implementation. Keep specs current and finish with checks/tests; update definitions, tests, and views together when changing the model. Add concise, model-specific instructions to `AGENTS.md` or `.github/copilot-instructions.md` if useful.
