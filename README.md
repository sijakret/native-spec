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

The [Acme Stockroom demo](skills/native-spec/examples/typescript/) models requirements, architecture, tests, and delivery as ordinary TypeScript values. [Its README](skills/native-spec/examples/typescript/README.md) explains the core ideas and links directly to the implementations.

- **Native references:** erased `specBindings` connect architecture blocks to exported and private code without changing runtime visibility.
- **Required verification:** every acceptance criterion directly references at least one executable test or suite, without a separate test-case artifact or relation map.
- **Complementary checks:** the compiler checks types and references; the audit checks complete ownership, actual test registrations, and architecture diagrams. Links do not prove behavioral correctness.
- **One source of truth:** the optional viewer and document renderers derive views from the same model, with no handwritten mirror or generated link ledger.

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
