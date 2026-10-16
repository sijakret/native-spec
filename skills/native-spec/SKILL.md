---
name: native-spec
description: Bootstrap and maintain a Native Spec using a repository's native language and tooling — project-specific artifacts such as requirements, architecture, tests, risks, and sprints as code with checked traceability. Use for greenfield or brownfield spec setup, tailoring the process model, adding/changing spec artifacts or relations, the spec-first change workflow, and adapting Native Spec to another ecosystem.
---

# Native Spec

Express specifications directly in the project's native language, beside the implementation. Reuse its compiler, editor, tests, and git instead of introducing a separate spec format or toolchain.

## Key Ideas

- **The model is yours.** Tailor artifact kinds, fields, relations, coverage rules, and delivery workflow to the project. Native Spec is an approach, not a prescribed process model.
- **Native code is the spec.** Model artifacts and relations with ordinary types and values. Use compiler checks where the language can express them; use native tests or runtime validation for the remaining rules.
- **Git is the spec store.** Agents read and edit specs with the same tools as code, keeping both in lock step in one diff.
- **Explicit project graph.** Maintain a complete inventory of artifacts and relations so checks can detect missing links, dangling endpoints, and cross-project references.
- **Canonical directed relations, declared once.** Derive reverse links and incoming/outgoing views rather than maintaining them separately.
- **Formats are renders.** Generate Markdown, HTML, and editor views from the native source of truth; do not hand-maintain mirrors. Keep views in sync when the model changes.

## Example Process Model

The bundled notes app illustrates **one possible model**, not a default or mandatory standard. Add, remove, rename, or replace kinds, fields, relations, and checks to fit the project. For example, a small library might need only requirements and tests, with no market-requirement layer or sprints.

| Kind | Purpose | Relation (from → to) |
| --- | --- | --- |
| Market requirement (MR) | User or market need | — |
| Software requirement (SR) | Concrete product behavior | `derivesFrom(SR, MR)` |
| Non-functional requirement (NFR) | Quality or platform constraint | — |
| Architecture block (ABB) | Responsibility, interface, and code ownership | `implementsRequirement(ABB, SR \| NFR)` |
| Test case (TC) | Verification intent and test-code references | `verifies(TC, MR \| SR \| NFR \| RISK)` |
| Risk | Failure mode and mitigation | `threatens(RISK, requirement)` |
| Sprint | Delivery slice and completion evidence | `delivers(SPRINT, any non-sprint)` |

Example coverage policy (tailor or replace): every SR derives from an MR and every MR is refined; every ABB implements and every SR/NFR is implemented; every TC verifies and every MR/SR/NFR/RISK is verified; every sprint delivers and every non-sprint is delivered; every risk threatens.

## Bootstrap

1. Choose the project's model first: which artifacts, fields, relations, and invariants are useful? Reuse existing process conventions; do not copy the example's kinds or sprint policy automatically.
2. Identify the repository's language, build system, and test runner. For TypeScript, use the [TypeScript reference](./references/typescript.md) and [runnable example](./examples/typescript/) as a starting point to tailor. For other ecosystems, implement the chosen model natively; do not add a TypeScript toolchain just for specs.
3. Represent artifacts with stable IDs and native fields, and relations with checked endpoints. Keep an explicit project inventory. Choose native file organization and naming; the example's suffixes and layout are not universal requirements.
4. Add checks for the chosen model to the existing build/test workflow: endpoint validity, project membership, duplicates, and whatever coverage, date, or completion rules apply. Test invalid cases as well as a valid graph; do not promise compile-time guarantees the language cannot provide.
5. Populate the project, then run the native checks and tests until clean. Add generated views only as needed. The paths below illustrate using the example model.

**Greenfield (example model):** write MRs first, derive SRs, name NFRs, then add ABBs, TCs, and risks as the design emerges. The first sprint delivers the first slice; keep items planned until implemented.

**Brownfield (example model):** reverse-engineer the current state, then change it spec-first.
1. ABBs from existing packages/modules: current ownership, interfaces, responsibilities, and source files.
2. TCs from existing test suites, referencing real test file paths.
3. SRs from existing user-visible capabilities, grouped under a few MRs; NFRs from existing constraints (security, performance, platform).
4. Risks only where a real mitigation exists in code or tests.
5. One completed baseline sprint delivering every artifact, recording that it documents the pre-existing state.
6. Let spec-check diagnostics drive the missing links. Describe what the code does now, not aspirations.

## Change Workflow

1. Update affected artifacts in the project's chosen model; register new ones in the project inventory.
2. Plan delivery and verification using the project's workflow, including architecture and documentation review where applicable. Add a sprint only if the model uses sprints.
3. Add canonical relations; run the project's spec checks before implementing.
4. Implement; keep artifacts current, review them against the code, update any modeled delivery status, and run spec checks and tests.

Changing the process model means updating its native definitions, checks, tests, and generated views together.

## Agent Instructions Snippet

Add to the repo's `AGENTS.md` / `.github/copilot-instructions.md`:

```md
## Native Spec
Specs are native code beside the implementation and the source of truth; do not hand-maintain rendered mirrors.
Register artifacts in the project inventory and declare each directed relation once.
Use the project's chosen artifact kinds, relations, and coverage rules; the bundled model is only an example.
For product changes: update affected specs, run spec checks before implementing, keep specs current, and finish with spec checks and tests.
```

Adapt the snippet with the repository's chosen model, paths, and commands; the TypeScript reference provides a concrete version for its example model.
