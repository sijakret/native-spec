import { artifact } from "../factory.js";

export const codeTraceability = artifact.nonFunctionalRequirement({
  id: "REQ-NFR-002",
  title: "Enumerable and Architecture-Linked App Code",
  tags: ["traceability"],
  description:
    "Audit production source directly, link code to architecture blocks, and resolve requirements through their implementation relations, without a separate link ledger.",
  acceptanceCriteria: [
    {
      id: "enumerate-code",
      description:
        "Enumerate every file under src, including styles and declarations, and every implemented callable in JS/TS source.",
    },
    {
      id: "requirement-links",
      description:
        "Every module has a header @specModule annotation; every named callable has its own @spec annotation naming at least one actual ABB. Derive requirement coverage through implements relations, allowing optional direct requirement links but not as a substitute for ABB ownership.",
    },
    {
      id: "callback-inheritance",
      description:
        "Inline callbacks inherit the nearest enclosing callable's ABB ownership, derived requirements, and optional direct requirement links, or the module's for top-level initializers.",
    },
    {
      id: "reject-invalid-links",
      description:
        "Invalid annotations, missing ABB ownership, dangling implementation relations, and ABB file-list mismatches fail the audit, as do duplicate code targets, unsupported file languages, and unsupported dynamic callable names.",
    },
    {
      id: "app-boundary",
      description:
        "Tests, specs/viewer/build tooling, generated output, and vendor dependencies are outside the app-code boundary.",
    },
    {
      id: "code-inventory",
      description:
        "Expose an in-memory inventory with ABB IDs, derived requirements, separate optional direct requirement links, source positions, and inheritance provenance; offer optional JSON on stdout without generated intermediate files, and do not claim behavioral correctness from linkage.",
    },
  ],
});
