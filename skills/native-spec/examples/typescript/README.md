# TypeScript Example

**Acme Stockroom** is a browser-only inventory app demonstrating Native Spec. The specification is ordinary TypeScript beside the implementation, not a separate document format.

## Core Ideas

- **One model.** [The process definition](specs/definition/process.ts) owns artifact types, relations, and constraints. [The project](specs/definition/project.ts) explicitly assembles artifacts and relations. Tailor the model to your project.
- **Native code links.** ABBs reference actual modules and callables through erased types. Source modules export `specBindings`; `Bindings` checks the same contract at both ends without exporting private values. See the [domain ABB](specs/artifacts/architecture/001-stock-domain.abb.ts) and [implementation](src/domain.ts).
- **Required verification.** Every acceptance criterion requires `tests: testedBy<[...]>()` referencing one or more real Vitest tests or suites. Private callbacks use type-only `specBindings`; no separate test-case artifact, criterion dictionary, or `verifies(...)` wiring is needed. See the [inventory tests](specs/artifacts/requirements/001-inventory.sr.ts) and [persistence suite reference](specs/artifacts/requirements/003-local-data.sr.ts).
- **Complementary checks.** TypeScript requires nonempty reference tuples and checks symbols, callable constraints, and artifact relations. The [audit](specs/audit/code-audit.ts) resolves registered tests and nonempty suites, rejects skipped targets, requires exhaustive app ownership, and derives code -> ABB -> requirements. Custom wrappers and conditional registrations are not inferred. The audit is process tooling, verified by its own tests, not a project requirement or ABB.
- **Links are not proof.** A valid reference does not establish that assertions satisfy a requirement. Run the tests and review their relevance. Test results are separate from declared coverage.
- **Derived views.** HTML, Markdown, and the optional VS Code viewer render the same model. No handwritten mirror, generated ledger, runtime test import, or custom editor diagnostic provider is needed.

## Run and Check

```sh
npm install
npm run dev            # stockroom app
npm test               # types, audits, and executable tests
npm run build          # checked static app
npm run specs:test     # specification invariants and viewer tests
npm run specs:render -- markdown
```

`npm run specs:check` runs only the spec compiler. `npm run code:check` runs coverage and architecture checks; `npm run --silent code:inventory` prints an optional JSON inventory to stdout.

## Authoring

Keep one artifact per `<number>-<slug>.<kind>.ts` file. Declare outgoing relations beside their source artifact and collect them explicitly in [the artifact index](specs/artifacts/index.ts). Import targets from their owning files, not the index.

Give criteria stable local IDs and direct test references. A tuple can contain several tests, a suite, or both. Register named callbacks with `it`/`test` or `describe`/`suite` normally and expose only their types through `specBindings`. Native navigation and rename remain available; use Go to Type Definition for private bindings.

The [architecture overview](specs/artifacts/architecture/000-architecture.ts) must include every ABB; each ABB needs a summary diagram. Excalidraw figures live in adjacent `figures/` folders and retain editable scenes and visible ABB metadata. The architecture audit checks the actual SVGs.

Update affected artifacts and tests together, record delivery in a sprint, and run checks before closing it. For bootstrapping another project, use [the Native Spec skill](../../SKILL.md).

## Viewer

Run `npm run viewer:install`, then reload VS Code. Artifact files open in the visual editor; source actions jump to declarations. Titles, descriptions, lists, and checkboxes support minimal source edits. Edit Excalidraw sidecars with the Excalidraw extension.

ABBs show **Code Links**, grouped by file and collapsed by default. Each acceptance criterion lists its own tests compactly, one line per file; suites are tagged, and selecting a test opens its declaration. There is no separate requirement-level test list, and test references do not widen the production-code boundary.

Run `npm run dev --prefix specs/utils/spec-viewer` for the read-only browser preview. `#spec-architecture` opens the architecture and `#spec-overview` opens the catalog. The viewer finds the nearest spec project; `nativeSpec.specsFolder` is the fallback.

## Demo Boundaries

The app loads pinned **lit-html 3.3.1** from jsDelivr at runtime. CDN availability and trust are required. Vite produces relative static assets suitable for a CDN subpath.

Workspace data is unencrypted browser-local storage, not a shared database. Export backups before clearing it. Stale-tab writes are detected, but there is no authentication, backend, telemetry, encryption, or multi-user synchronization.
