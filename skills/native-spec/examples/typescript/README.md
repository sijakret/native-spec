# TypeScript Example

**Acme Stockroom** is a working single-user inventory and order desk, and one example of a Native Spec model. Tailor its kinds, fields, relations, coverage rules, and workflow to your project.

## Run the App

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

- **Overview:** stock totals, low-stock indicators, and recent orders.
- **Inventory:** seeded products, name/SKU search, and stock receipts.
- **Orders:** reserve one product per order, fulfill it, or cancel it. Reservations reduce availability, fulfillment deducts on-hand stock, and closed orders cannot transition again.
- **Local workspace:** persistence, validated JSON import/export, and confirmed demo reset. Invalid imports and failed writes do not replace the valid workspace.

Vite builds static assets with relative paths, suitable for a CDN subpath. The app loads **lit-html 3.3.1 from jsDelivr at runtime**; the local development dependency provides types, not the browser implementation. Network access and trust in that CDN are required. No runtime framework bundle, backend, login, encryption, or telemetry is added.

Data is **unencrypted browser-local storage**, not a shared inventory database. Export backups before clearing browser data. Stale-tab writes are detected, but this is not an atomic multi-tab or multi-user system.

## Exhaustive Code Traceability

Application source declares its implementing architecture blocks through comment annotations:

```ts
/** @specModule ABB-001 */

/** @spec ABB-001 */
export function reserveOrder(...) { ... }
```

The [source audit](./specs/audit/code-audit.ts) independently enumerates the entire app source tree, validates ABB ownership, and derives requirement coverage through the ABB's `implementsRequirement` relations: **code -> ABB -> requirements**. These comments are checked by the audit, not by TypeScript's type system. The analyzer returns validated links and source positions directly in memory; no handwritten ledger, generated intermediate file, or preprocessing stage is involved.

- Every file under `src/` has a `@specModule` header naming at least one ABB, including CSS and declaration files. Header coverage does not cover named callables.
- Every implemented named callable has its own leading `@spec` annotation naming an ABB. Annotate the containing variable or property for assigned callables. Multiple IDs can be separated by spaces or commas, or written as repeated tags in a multiline comment.
- Direct requirement IDs are optional refinements, for example `@spec ABB-001 REQ-SR-002`; they cannot replace ABB ownership. Shared implemented requirements are deduplicated. Inventory entries expose `architectureBlocks`, combined `requirements`, and separate `directRequirements` arrays.
- Inline callbacks inherit their nearest enclosing callable's ABBs and requirement links, or the module's at top level. They are still enumerated with source positions and inheritance provenance.
- When an ABB declares `files`, source annotations must agree with that list, and every listed `src/` file must exist and name the ABB in its module header. Tooling-only paths stay outside the app audit. File lists do not supply missing source annotations.
- TypeScript's AST supplies TS/JS comments and declarations, including JSX. PostCSS supplies CSS comments at file granularity. Strings, templates, regex literals, and JSX text do not count as annotations. Other source languages fail closed until a suitable parser is added.
- Missing, empty, unknown, duplicate, ambiguous, or unattached annotations fail the audit, as do ABBs without implemented requirements, dangling implementation relations, inconsistent file ownership, misplaced module headers, duplicate symbols, dynamic callable names, and undeclared callable assignments. Specs, tests, build/viewer tooling, dependencies, and generated output are outside this explicit production-app boundary.

```sh
npm run code:check
npm run --silent code:inventory   # JSON on stdout
```

`npm run build` enforces types, graph consistency, and code coverage, then builds only the app. Vite strips the annotations from production JS and CSS. `code:inventory` is an optional stdout view, not a build input or an automatically generated file. Links are not proof that code fulfills a requirement: domain, persistence, deployment, audit-fixture tests, and browser validation establish behavior separately.

## Acceptance-Criterion Verification

Every requirement has a nonempty `acceptanceCriteria` list of `{ id, description }` values. IDs are stable, unique within the requirement, and lowercase kebab-case (for example, `search` or `reserve-stock`), so reordering criteria does not change their identity.

Link a test case to a specific criterion, not to the requirement as a whole:

```ts
verifies(stockroomSuite, inventory, "search"),
verifies(stockroomSuite, inventory, "availability"),
```

Every criterion needs at least one test-case link. `verifies` checks the selected requirement's criterion IDs, and `defineProject` checks complete coverage at compile time. `validateProject` rejects uncovered criteria, unknown criterion IDs, direct requirement verification, and duplicate links at runtime. Renaming a criterion requires updating its links. These links declare verification coverage, not test execution or proof of acceptance.

HTML, Markdown, and the viewer list each criterion's tests; outgoing test links name and target the criterion. Requirement-level summaries deduplicate test cases. Risk verification stays direct (`verifies(stockroomSuite, invalidStock)`); derivation, implementation, delivery, and code-traceability links retain their artifact-level targets.

## Architecture Overview

[000-architecture.ts](./specs/artifacts/architecture/000-architecture.ts) owns the project overview, intended uses, and diagrams. `definition/project.ts` imports it directly, so removing or renaming the required module fails compilation. It is an overview, not another ABB.

The main diagram describes the whole system: every ABB, the browser/runtime boundary, operator, runtime CDN, local storage, JSON backups, and development/build-time auditing. The example uses an editable Excalidraw SVG: `architectureFigure(figure(import.meta.url, 1, "Architecture overview"), [stockDomain, browserStorage, inventoryDesk, codeTraceabilityAudit])`. Its sidecar is `000-architecture.figure-001.excalidraw.svg`.

Every ABB requires a `summaryDiagram`, either an Excalidraw figure or a nonempty Mermaid block. For example, `summaryDiagram: figure(import.meta.url, 1, "Browser storage summary")`. The front page renders each ABB's summary beside its introduction; the ABB's own page and HTML/Markdown exports render it too. Supplementary `diagrams` remain optional. All four example summaries are Excalidraw SVGs with their editable scenes embedded.

Summary figures use square compositions, displayed beside each ABB's introduction at every editor width. Cap images at 30% of the row and 240px; do not stack them beneath the text. The architecture page lays building blocks out as cards (two columns on wide editors, one on narrow ones) and omits diagram captions there; titles remain the figures' accessible labels. Use Excalidraw's standard organic strokes by default (`roughness: 1`, `strokeWidth: 2`), and export through Excalidraw so the visible SVG and editable scene match. Keep the whole-system overview at its natural aspect ratio.

For Mermaid overviews, `architectureDiagram({ title, blocks, connections })` remains supported. `blocks` references actual ABB values; connections reference their `from` and `to` ABBs, with a `label` and optional `dashed` flag. The helper renders every declared block, including isolated blocks, directly in memory.

For projects with ABBs, `validateProject` requires a structured overview diagram and compares its nodes with the registered ABB inventory. Missing, unknown, duplicate, foreign-project, or stale-title nodes fail validation, as do undeclared connection endpoints and Mermaid source detached from its declarations. Adding an ABB therefore requires updating the overview. ABB IDs appearing in arbitrary diagram text do not count as coverage. These are runtime invariants, checked by `code:check` (and thus `check` and `build`) and the tests under `audit/`; TypeScript checks node and endpoint kinds, not complete overview coverage. No generated files or preprocessing stage are needed.

`audit/architecture-audit.ts` additionally reads the actual Excalidraw SVG and embedded scene, using an XML parser and Excalidraw's binary payload decoding. ABB nodes carry `customData.nativeSpec: { project: "acme-stockroom", kind: "architecture-block", id: "ABB-001" }` on a visible rectangle, ellipse, or diamond, with a bound text label containing the ABB ID. Keep this metadata when editing. The whole-system scene must contain every registered ABB exactly once; a summary must contain its owning ABB. Deleted/hidden nodes, unbound or invisible labels, duplicate/foreign references, missing sidecars, and SVGs without editable scenes fail validation. These checks run in the existing audit and visual architecture previews, with no ledger or intermediate diagram-generation stage. They check coverage and visibility, not whether the diagram fully explains the system; that remains an architecture-review task.

The visual architecture page is an introductory article: architectural context, the whole-system diagram, then descriptions, summaries, and links for the building blocks. It does not list requirements, tests, risks, sprints, product workflows, or specification metrics. Unsaved architecture previews run the same validation, so an incomplete overview displays a coverage error immediately. The full specification catalog remains a separate index page.

## Implementation

- Each artifact is one `.ts` file exporting one frozen value and, when needed, an outgoing relation tuple such as `inventoryRelations`.
- `defineProject` receives explicit `as const` artifact and relation lists. Missing required links, dangling endpoints, and cross-project artifacts fail `tsc` with `__specErrors: "Missing verifies target: software-requirement:REQ-SR-001:search"`-style messages. Dynamic discovery would erase these checks.
- Declare directed relations once, beside their source artifacts; `artifacts/index.ts` collects their tuples with explicit spreads, and `buildGraph` derives incoming/outgoing views. Artifact modules import targets directly from their owning files, never through the collecting index. Keep reusable relation constructors and checks in `definition/process.ts`.
- Project `overview.intendedUses` lists the intended workflows and scope; overview diagrams describe the architecture, system boundary, and dependencies. The overview is authored in `artifacts/architecture/000-architecture.ts` and appears on the viewer landing page and in HTML/Markdown exports.
- `validateProject` covers complete architecture overviews, duplicates, dangling endpoints, criterion identity and test coverage, sprint dates, and completed sprints with open tasks.
- Diagrams require a `title` alongside `language` and `source`. TypeScript catches omitted titles; `validateProject` rejects empty or whitespace-only titles in both overview and artifact diagrams. HTML, Markdown, and the viewer render the title as a caption; artifact captions support editing and source jumps.
- Excalidraw figures live in sidecar files next to their owning module: `figure(import.meta.url, 1, "Order reservation states")` in `001-stock-domain.abb.ts` refers to `001-stock-domain.abb.figure-001.excalidraw.svg`. Shared figure constants can live in a separate module to avoid circular artifact imports: `001-stock-domain.figures.ts` exports `orderStates`, passing the owning artifact's URL to `figure`. The file is a plain SVG with the editable scene embedded, so GitHub, Markdown viewers, and the Excalidraw VS Code extension all open it. Use a figure anywhere by importing its constant: `diagrams: [orderStates]` adds a captioned figure, `${orderStates.ref}` in a text field links to it, and `${orderStates.image}` embeds it inline. Both tokens are Markdown link/image syntax limited to `.excalidraw.svg` targets, so Markdown exports keep them as-is and HTML/viewer output renders them. Fields containing tokens are template literals, so the viewer offers a source jump instead of inline text editing for them. A test checks that every referenced figure file exists.
- `utils/output/views.ts` maps every non-identity field per kind; adding or retyping a field fails `specs:check` until its view is declared.

## Artifact Naming

| Kind                       | ID            | File suffix  |
| -------------------------- | ------------- | ------------ |
| Market requirement         | `REQ-MR-001`  | `.mr.ts`     |
| Software requirement       | `REQ-SR-001`  | `.sr.ts`     |
| Non-functional requirement | `REQ-NFR-001` | `.nfr.ts`    |
| Architecture block         | `ABB-001`     | `.abb.ts`    |
| Test case                  | `TC-001`      | `.tc.ts`     |
| Risk                       | `RISK-001`    | `.risk.ts`   |
| Sprint                     | `SPRINT-0001` | `.sprint.ts` |

Filenames are `<ID number>-<slug>.<suffix>`, e.g. `001-stock-domain.abb.ts`, `0001-first-slice.sprint.ts`; the suffix drives the viewer.

## Layout

```text
specs/
  artifacts/factory.ts           artifactFactory("<project-id>"), completedTask()
  artifacts/<kind folder>/*.ts   one artifact + its outgoing relations per file
  artifacts/architecture/000-architecture.ts  required overview and complete ABB diagram
  artifacts/index.ts             explicit `artifacts` + collected `relations` tuples
  definition/process.ts          model, typed relations, static + runtime checks
  definition/project.ts          defineProject(...), default export
  audit/code-audit.ts            source annotation parsing, enumeration, coverage
  audit/architecture-audit.ts    editable SVG scenes, visible ABB coverage, summaries
  audit/code-check.ts            code:check / code:inventory (stdout only)
  audit/code-audit.test.ts       annotation and parser invariants
  audit/process.test.ts          artifact/process invariants and rendering checks
  audit/process.type-test.ts     compile-time process invariants
  utils/output/                  views, Markdown and HTML renderers
  utils/cli.ts                   specs:render
  utils/spec-viewer/             VS Code extension (standalone npm package)
  viewer.test.ts, tsconfig.json
```

## Bootstrap

1. Copy `specs/` from this example to the repo root (or another folder; see viewer setting).
2. Add to the root `package.json` (merge; keep existing scripts):
   ```json
   "scripts": {
     "specs:check": "tsc -p specs/tsconfig.json",
    "specs:test": "npm run specs:check && vitest run specs/audit specs/viewer.test.ts",
     "specs:render": "tsx specs/utils/cli.ts"
   },
   "devDependencies": { "@types/node": "*", "@xmldom/xmldom": "*", "postcss": "*", "tsx": "*", "typescript": "*", "vitest": "*" }
   ```
   The spec project must resolve `tsx` and `typescript` from its containing package; the viewer loads both there. `specs/tsconfig.json` is standalone; exclude `specs/` from the app's tsconfig if its `include` would pick it up.
3. Set the project id in `artifacts/factory.ts`, title in `definition/project.ts`, and overview in `artifacts/architecture/000-architecture.ts`.
4. Tailor the model and replace the example artifacts. If retaining the example model, follow the main skill's example greenfield or brownfield path: start with `SPRINT-0001`; use `planned` until implemented, or `completed` for a brownfield baseline with `implementation` recording the pre-existing state. To retain code auditing, annotate application source and adapt the source root in `audit/code-check.ts`, then wire that command into your build. Keep artifact, process, and annotation invariants under `audit/`.
5. Iterate on `npm run specs:check` until clean and `npm run specs:test` passes.

## Maintaining the Example

- Export canonical outgoing links beside their source artifacts as named `as const` tuples; register artifacts and collect the relation tuples in `artifacts/index.ts`.
- Test cases use `code` for real test file paths; architecture blocks use `files` for source paths.
- An architecture block is one component with its own responsibility boundary, not the whole app. The example has four: stock and order domain, validated browser storage, inventory desk UI, and the build-time code traceability audit. Each lists its files and implements only the requirements it realizes; a requirement such as REQ-SR-001 may be implemented by several blocks (domain rules plus UI).
- Keep `artifacts/architecture/000-architecture.ts` current: its structured overview diagram must contain every registered ABB, including build-time tooling. Import ABBs directly from their owning modules, not the collecting index.
- Give every ABB a required `summaryDiagram`; use Excalidraw for the example's system and summary diagrams. Preserve visible ABB nodes, their bound ID labels, and `customData.nativeSpec` references when editing the SVG sidecars.
- Sprints include tasks, verification, a Mermaid diagram, `architectureReview` tasks naming affected ABBs (or a done task explaining no impact), and `documentationIntegrity` tasks.
- Run `npm run specs:check` before implementation and `npm run specs:test` before closing a sprint.
- For model changes, update `definition/process.ts` and `utils/output/views.ts`, plus `utils/output/rendering.ts` sections/labels for new kinds or relations.
- Generate documents with `npm run specs:render -- markdown` or `npm run specs:render -- html`.

## VS Code Viewer

`specs/utils/spec-viewer` is a `CustomTextEditor` registered as default for the kind suffixes, `**/artifacts/**/index.ts`, and `**/artifacts/architecture/000-architecture.ts`. It renders live document text (including unsaved edits and git diff sides) and edits titles, descriptions, list items, and task checkboxes as minimal source edits. The architecture overview has a visual page with its diagrams and artifact navigation; edits in its source preview without saving. Excalidraw figures are view-only; edit their `.excalidraw.svg` sidecars with the Excalidraw VS Code extension. Figure references open a read-only preview dialog. Overview, index, and diff views stay read-only.

Acceptance criteria and relations share a counted list-box renderer and common row styles. Each criterion shows its description first, with its ID and tested-by links on an aligned secondary line; descriptions stay editable.

- Install: `npm install --prefix specs/utils/spec-viewer && npm run install:local --prefix specs/utils/spec-viewer` (needs the `code` CLI on PATH), then reload the window.
- Open the architecture article with **Native Spec: Open Overview** in the Command Palette, or open `specs/artifacts/architecture/000-architecture.ts`. It introduces the architecture with diagrams and links only to its building blocks. Open `specs/artifacts/index.ts` for the separate specification catalog, intended uses, and metrics.
- Every page has a compact breadcrumb header linking back to the specification index, with no sidebar. ABB breadcrumbs also link to the architecture article. Artifact and relation links open in the custom editor.
- Relations appear as compact cards grouped by direction and type, with counts and one linked artifact per row. Rows show the artifact icon, muted ID, and title inline when space permits, wrap long titles without truncation, and retain hover/focus source actions.
- Checklists use bullet-free rows with a fixed checkbox column, keeping wrapped text and nested tasks aligned while preserving editing and source actions.
- Relation cards use their full available width. When a card is at least 560px wide, other same-kind, same-relation peers appear in a second column that starts at half the card width, headed **Also implemented by** for outgoing relations, or **Also implemented**, **Also tested**, **Also delivered** for incoming ones. Drag the divider (or focus it and use the arrow keys, Home, or End; double-click to reset) to resize the columns of all relation cards together. Narrow cards move those links to a smaller, muted, indented line beneath the title. Rows are tightly padded, and long peer titles wrap naturally. Peer links exclude the current item; cards without other peers have no extra column or line. There is no graph widget or hover overlay.
- A project icon identifies the overview, and each artifact kind has a theme-based color identity: market requirements yellow, software requirements blue, non-functional requirements purple, architecture orange, tests green, risks red, and sprints cyan. Colors use VS Code's chart palette and terminal cyan token, so they follow the active theme; shapes and labels distinguish types even when a theme reuses colors.
- Use the **Open Source** icon in the top-right corner to switch to the underlying TypeScript document; its name remains in the tooltip and accessible label. Artifact headings have one source button at the end, revealed on hover or keyboard focus, without gaps between the ID, separator, and title. Hover another field or focus its code button to jump to that exact value, including unsaved edits, nested tasks, and diagram source. Catalog and relation links also have source buttons. Source navigation remains available in read-only/index views and for the current revision in diff views.
- The panel uses VS Code's fonts, theme colors, corner-radius tokens, and focus styles, including light, dark, and high-contrast themes. Mermaid boxes use the theme's secondary-button fill/text colors and contrasting borders; rectangular boxes and system boundaries follow the small/medium radius tokens without changing semantic shapes such as circles or storage cylinders. Diagrams follow live theme changes, and the layout adapts to narrow editors. Excalidraw figures are inlined and recolored to the theme: ink, greys, and white follow the foreground, muted, and background colors; colored strokes use the chart colors; pastel fills become chart colors tinted toward the background. Arrow-label gaps are refitted to the rendered text. The stored file keeps Excalidraw's light palette for exports and other viewers.
- Debug: build with `npm run build --prefix specs/utils/spec-viewer` and launch an Extension Host with `--extensionDevelopmentPath=<repo>/specs/utils/spec-viewer` (see the example's `.vscode` folder).
- Browser preview: `npm run dev --prefix specs/utils/spec-viewer`. It opens the architecture article by default (`#spec-architecture`); `#spec-overview` opens the separate specification catalog. It uses the same artifact navigation and read-only figure previews. The preview-only theme menu offers System, Light, and Dark and remembers the selection. System follows the browser's preference, not VS Code's theme.
- The viewer finds the nearest enclosing spec project (`definition/project.ts`), including examples nested in a larger workspace. `nativeSpec.specsFolder` (default `specs`) is a workspace-relative fallback. Worker and edit dependencies resolve from the spec project.
- Use "Reopen Editor With… → Spec Artifact" to return from source to the custom viewer.

## TypeScript Agent Instructions Snippet

This snippet assumes the example model is retained; adapt it to the chosen model.

```md
## Native Spec

Process artifacts are TypeScript values under `specs/` and the only source of truth; never hand-author Markdown mirrors.
Name artifacts `<ID number>-<slug>.<kind>.ts` and assemble them in `specs/artifacts/index.ts`.
Declare each relation once beside its source artifact with derivesFrom, implementsRequirement, verifies, delivers, threatens; export a named `as const` tuple and collect it in `specs/artifacts/index.ts`.
Import targets directly from their owning artifact files, not from the collecting index; keep shared references separate when needed to avoid circular imports.
Keep the overview in specs/artifacts/architecture/000-architecture.ts; use architectureDiagram with actual ABB values, and include every registered ABB in its blocks. Runtime validation checks completeness; TypeScript checks node and endpoint kinds.
Use architectureFigure for an Excalidraw whole-system overview, and give every ABB a summaryDiagram (Excalidraw or Mermaid). Preserve visible ABB node references and bound ID labels in the editable scenes; the audit checks the actual SVGs, not just the TypeScript block lists.
Give acceptance criteria stable local IDs and link tests with verifies(testCase, requirement, criterionId); every criterion needs coverage.
Link app code to ABBs with @specModule file headers and @spec callable comments; derive requirement coverage through implementsRequirement relations, with optional direct requirement refinements. Cross-check declared ABB files. Validate directly from source without a ledger or generated intermediate files, and keep invariant tests and code audits in specs/audit/.
For product changes: update artifacts and add a sprint, run `npm run specs:check` before implementing, keep architecture blocks current, and finish with `npm run specs:test`.
```
