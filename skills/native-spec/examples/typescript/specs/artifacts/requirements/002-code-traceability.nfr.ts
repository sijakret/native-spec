import { artifact } from "../factory.js";

export const codeTraceability = artifact.nonFunctionalRequirement({
  id: "REQ-NFR-002",
  title: "Enumerable and Architecture-Linked App Code",
  tags: ["traceability"],
  description:
    "Link production modules and callables to architecture blocks through erased TypeScript symbol references, audit complete ownership, and derive requirements through their implementation relations without a link ledger or custom editor validator.",
  acceptanceCriteria: [
    {
      id: "enumerate-code",
      description:
        "Enumerate every file under src, including styles and declarations, and every implemented callable in JS/TS source.",
    },
    {
      id: "requirement-links",
      description:
        "Every TypeScript module and named callable has an Implementation type link to at least one registered ABB. Declare private links in a single ABB interface with an inline contract and checked bindings field; the source satisfies that same contract with an exported type-only local map. Do not export the private functions, maintain a separate slot manifest, or repeat private targets in the public target tuple. Supporting CSS and ambient declaration files use ABB file entries. Derive requirement coverage through implements relations.",
    },
    {
      id: "callback-inheritance",
      description:
        "Inline callbacks inherit the nearest enclosing callable's ABB ownership and derived requirements, or the module's for top-level initializers.",
    },
    {
      id: "reject-invalid-links",
      description:
        "The native TypeScript compiler and editor reject missing imported modules, exports, methods, and private slots, plus missing or extra private bindings and incompatible declared signatures. The ABB checks the source export even if the source omits its binding helper. The build-time audit resolves actual declaration identity and rejects unresolved targets, missing ABB ownership, dangling implementation relations, missing supporting files, duplicate targets, unsupported file languages, and unsupported dynamic callable names.",
    },
    {
      id: "app-boundary",
      description:
        "Tests, specs/viewer/build tooling, generated output, and vendor dependencies are outside the app-code boundary.",
    },
    {
      id: "code-inventory",
      description:
        "Expose an in-memory inventory with ABB IDs, derived requirements, source positions, and inheritance provenance; offer optional JSON on stdout without generated intermediate files, and do not claim behavioral correctness from linkage.",
    },
  ],
});
