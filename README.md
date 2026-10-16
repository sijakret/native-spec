# Native Spec

Fast and durable specification modelling has become an essential building block in AI-native software development.

Spec-driven systems, however, often introduce drag or suffer from tooling and complexity.

Native Spec solves this by simply expressing your specifications directly in your native language tooling.

## Why Native Spec

Modeling your specification within your native toolchain has a lot of benefits.

- **Checked traceability.** Native compiler checks & analysis catch missing required links and references to missing artifacts. No separate schema, parser, or custom format.
- **Next to no overhead.** Your editor, compiler, tests, and git are the spec infrastructure: autocomplete, go-to-definition, rename, and review all just work.
- **Zero Lock-in.** No additional vendors or tools required.
- **Agent-ready.** Specs live in git beside the code, so agents read and update them in the same diff as the implementation, in lock step.
- **Any format on demand.** Markdown and HTML can trivially be forward-rendered from the graph. Never hand-maintained, never stale.

Intuitively this is some sort of optimum. Zero additional tooling is needed and programming language typically have very sharp and compact semantics to express data shapes & relations. It is probably very hard to achieve the same level of expressiveness and traceability with less ressources.

## TypeScript example

This notes-app example links a user need, a software requirement, and a test suite as TypeScript values (see [full definition](skills/native-spec/examples/typescript/specs/definition/engine.ts)). Additional fields and imports are omitted for illustration:

```ts
const captureAndFindNotes = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Capture thoughts and find them again",
});
const fullTextSearch = artifact.softwareRequirement({
  id: "REQ-SR-001",
  title: "Search note titles and bodies",
});
const noteStoreSuite = artifact.testCase({
  id: "TC-001",
  title: "Saved notes are searchable",
  code: ["tests/store.test.ts"],
});

// these relations are required, ommitting in case
// one of them is missing the language service can already signal
derivesFrom(fullTextSearch, captureAndFindNotes);
verifies(noteStoreSuite, fullTextSearch);
```

You can then also instantiate your spec for additional runtime checks or other processing:

```ts
// your live spec, checked for consistency already
export const project = defineProject({
  id: "acme-notes",
  title: "Acme Notes",
  overview: {
    description:
      "A private note-taking app: capture in seconds, find anything by what it says.",
    //..
  },
  artifacts,
  relations,
});
```

## Get Started

- [SKILL.md](skills/native-spec/SKILL.md) is the agent skill for bootstrapping greenfield and brownfield.
- [examples/typescript/](skills/native-spec/examples/typescript) is a runnable template with the VS Code viewer.

```sh
cd skills/native-spec/examples/typescript
npm install
npm run specs:test
npm run specs:render -- markdown
npm run viewer:install   # optional: package and install the VS Code viewer
```
