import {
  figure,
  implementsRequirement,
  type Implementation,
} from "../../definition/process.js";
import type * as sourceAudit from "../../audit/code-audit.js";
import type * as sourceCheck from "../../audit/code-check.js";
import { artifact } from "../factory.js";
import { codeTraceability } from "../requirements/002-code-traceability.nfr.js";

export const codeTraceabilityAudit = artifact.architectureBlock({
  id: "ABB-004",
  title: "Code Traceability Audit",
  tags: ["build", "traceability"],
  summaryDiagram: figure(import.meta.url, 1, "Code traceability audit summary"),
  description:
    "A build-time coverage audit that enumerates app code, resolves erased Implementation type aliases through TypeScript symbols, and derives requirement coverage through the project graph. The native compiler and editor check imported modules and methods; the audit verifies ownership without a ledger or runtime spec dependencies.",
  diagrams: [
    {
      title: "Traceability boundaries",
      language: "mermaid",
      source: `flowchart LR
  Audit[Coverage audit] --> Source[TypeScript symbol references]
  Source --> Blocks[Architecture block owners]
  Blocks -->|implements| Requirements[Requirement artifacts]
  Audit --> Inventory[In-memory inventory]`,
    },
  ],
  responsibilities: [
    "Enumerate source files and named callables independently of Implementation type aliases; inherit ownership only for inline callbacks.",
    "Resolve imported modules, constructors, methods, and source-local private helpers through TypeScript symbols, and derive requirements through ABB implementation relations.",
    "Require exhaustive ownership, validate supporting CSS and declaration files, and expose optional JSON on stdout without editor workers or a persisted ledger.",
  ],
});

export type CodeTraceabilityImplementation = Implementation<
  typeof codeTraceabilityAudit,
  [typeof sourceAudit, typeof sourceCheck]
>;

export const codeTraceabilityAuditRelations = [
  implementsRequirement(codeTraceabilityAudit, codeTraceability),
] as const;
