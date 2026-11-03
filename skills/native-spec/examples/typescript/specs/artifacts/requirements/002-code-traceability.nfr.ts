import { artifact } from "../factory.js";
import { testedBy } from "../../definition/process.js";
import type * as auditTests from "../../audit/code-audit.test.js";

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
      tests: testedBy<[auditTests.specBindings["enumerateCode"]]>(),
    },
    {
      id: "requirement-links",
      tests: testedBy<[auditTests.specBindings["requirementLinks"]]>(),
      description:
        "Every TypeScript module and named callable has an Implementation type link to at least one registered ABB. Use one named contract and checked bindings map for exported and private callables alike, with Callable for functions/methods and Constructable for constructors. The source satisfies that same contract with an exported type-only bindings map. Do not export private values, maintain separate visibility-specific lists, or repeat callable targets in the module tuple. Supporting CSS and ambient declaration files use ABB file entries. Derive requirement coverage through implements relations.",
    },
    {
      id: "callback-inheritance",
      description:
        "Inline callbacks inherit the nearest enclosing callable's ABB ownership and derived requirements, or the module's for top-level initializers.",
      tests: testedBy<[auditTests.specBindings["callbackInheritance"]]>(),
    },
    {
      id: "reject-invalid-links",
      tests:
        testedBy<
          [
            auditTests.specBindings["invalidLinks"],
            auditTests.specBindings["compilerContracts"],
          ]
        >(),
      description:
        "The native TypeScript compiler and editor reject missing imported modules, exports, methods, slots, missing or extra bindings, non-callable or non-constructable symbols, and incompatible declared signatures. Binding constraints preserve the actual inferred signatures. The ABB checks the source export even if the source omits its binding helper. The build-time audit resolves actual declaration identity and rejects unresolved targets, missing ABB ownership, dangling implementation relations, missing supporting files, duplicate targets, unsupported file languages, and unsupported dynamic callable names.",
    },
    {
      id: "app-boundary",
      description:
        "Tests, specs/viewer/build tooling, generated output, and vendor dependencies are outside the app-code boundary.",
      tests: testedBy<[auditTests.specBindings["appBoundary"]]>(),
    },
    {
      id: "code-inventory",
      tests: testedBy<[auditTests.specBindings["requirementLinks"]]>(),
      description:
        "Expose an in-memory inventory with ABB IDs, derived requirements, source positions, and inheritance provenance; offer optional JSON on stdout without generated intermediate files, and do not claim behavioral correctness from linkage.",
    },
  ],
});
