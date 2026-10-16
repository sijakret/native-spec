# TypeScript Reference

The [runnable example](../examples/typescript/) implements one possible model for a small notes app. Tailor its kinds, fields, relations, coverage rules, and sprint workflow even when staying in TypeScript. Its APIs, filenames, commands, and viewer are TypeScript-specific, not prerequisites for other ecosystems.

## Implementation

- Each artifact is one `.ts` file exporting one frozen value.
- `defineProject` receives explicit `as const` artifact and relation lists. Missing required links, dangling endpoints, and cross-project artifacts fail `tsc` with `__specErrors: "Missing verifies target: software-requirement:REQ-SR-002"`-style messages. Dynamic discovery would erase these checks.
- Declare directed relations once; `buildGraph` derives incoming/outgoing views.
- `validateProject` covers duplicates, dangling endpoints, sprint dates, and completed sprints with open tasks.
- `utils/output/views.ts` maps every non-identity field per kind; adding or retyping a field fails `specs:check` until its view is declared.

## Artifact Naming

| Kind | ID | File suffix |
| --- | --- | --- |
| Market requirement | `REQ-MR-001` | `.mr.ts` |
| Software requirement | `REQ-SR-001` | `.sr.ts` |
| Non-functional requirement | `REQ-NFR-001` | `.nfr.ts` |
| Architecture block | `ABB-001` | `.abb.ts` |
| Test case | `TC-001` | `.tc.ts` |
| Risk | `RISK-001` | `.risk.ts` |
| Sprint | `SPRINT-0001` | `.sprint.ts` |

Filenames are `<ID number>-<slug>.<suffix>`, e.g. `001-note-store.abb.ts`, `0001-first-slice.sprint.ts`; the suffix drives the viewer.

## Layout

```text
specs/
  artifacts/factory.ts           artifactFactory("<project-id>"), completedTask()
  artifacts/<kind folder>/*.ts   one artifact per file
  artifacts/index.ts             explicit imports + `artifacts = [...] as const`
  definition/engine.ts           model, typed relations, static + runtime checks
  definition/relations.ts        `relations = [...] as const`
  definition/project.ts          defineProject(...), default export
  utils/output/                  views, Markdown and HTML renderers
  utils/cli.ts                   specs:render
  utils/spec-viewer/             VS Code extension (standalone npm package)
  engine.test.ts, engine.type-test.ts, tsconfig.json
```

## Bootstrap

1. Copy `examples/typescript/specs/` from the skill to the repo root (or another folder; see viewer setting).
2. Add to the root `package.json` (merge; keep existing scripts):
   ```json
   "scripts": {
     "specs:check": "tsc -p specs/tsconfig.json",
     "specs:test": "npm run specs:check && vitest run specs/engine.test.ts",
     "specs:render": "tsx specs/utils/cli.ts"
   },
   "devDependencies": { "@types/node": "*", "tsx": "*", "typescript": "*", "vitest": "*" }
   ```
   The root must resolve `tsx` and `typescript`; the viewer loads both from the workspace. `specs/tsconfig.json` is standalone; exclude `specs/` from the app's tsconfig if its `include` would pick it up.
3. Set the project id in `artifacts/factory.ts` and title/overview in `definition/project.ts`.
4. Tailor the model and replace the example artifacts. If retaining the example model, follow the main skill's example greenfield or brownfield path: start with `SPRINT-0001`; use `planned` until implemented, or `completed` for a brownfield baseline with `implementation` recording the pre-existing state.
5. Iterate on `npm run specs:check` until clean and `npm run specs:test` passes.

## Maintaining the Example

- Register artifacts in `artifacts/index.ts` and canonical links in `definition/relations.ts`.
- Test cases use `code` for real test file paths; architecture blocks use `files` for source paths.
- Sprints include tasks, verification, a Mermaid diagram, `architectureReview` tasks naming affected ABBs (or a done task explaining no impact), and `documentationIntegrity` tasks.
- Run `npm run specs:check` before implementation and `npm run specs:test` before closing a sprint.
- For model changes, update `definition/engine.ts` and `utils/output/views.ts`, plus `utils/output/rendering.ts` sections/labels for new kinds or relations.
- Generate documents with `npm run specs:render -- markdown` or `npm run specs:render -- html`.

## VS Code Viewer

`specs/utils/spec-viewer` is a `CustomTextEditor` registered as default for the kind suffixes and `**/artifacts/**/index.ts`. It renders live document text (including unsaved edits and git diff sides), edits titles, descriptions, list items, and task checkboxes as minimal source edits, links related artifacts to their files, draws Mermaid diagrams, and shows project metrics on `artifacts/index.ts`.

- Install: `npm install --prefix specs/utils/spec-viewer && npm run install:local --prefix specs/utils/spec-viewer` (needs the `code` CLI on PATH), then reload the window.
- Debug: build with `npm run build --prefix specs/utils/spec-viewer` and launch an Extension Host with `--extensionDevelopmentPath=<repo>/specs/utils/spec-viewer` (see the example's `.vscode` folder).
- Browser preview of the whole spec: `npm run dev --prefix specs/utils/spec-viewer`.
- Setting `nativeSpec.specsFolder` (default `specs`) locates `definition/project.ts`.
- Use "Reopen Editor With… → Text Editor" for raw source.

## TypeScript Agent Instructions Snippet

This snippet assumes the example model is retained; adapt it to the chosen model.

```md
## Native Spec
Process artifacts are TypeScript values under `specs/` and the only source of truth; never hand-author Markdown mirrors.
Name artifacts `<ID number>-<slug>.<kind>.ts` and assemble them in `specs/artifacts/index.ts`.
Declare each relation once in `specs/definition/relations.ts` with derivesFrom, implementsRequirement, verifies, delivers, threatens.
For product changes: update artifacts and add a sprint, run `npm run specs:check` before implementing, keep architecture blocks current, and finish with `npm run specs:test`.
```
