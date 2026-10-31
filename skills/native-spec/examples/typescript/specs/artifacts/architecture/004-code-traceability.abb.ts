import { figure, implementsRequirement } from "../../definition/process.js";
import { artifact } from "../factory.js";
import { codeTraceability } from "../requirements/002-code-traceability.nfr.js";

export const codeTraceabilityAudit = artifact.architectureBlock({
  id: "ABB-004",
  title: "Code Traceability Audit",
  tags: ["build", "traceability"],
  summaryDiagram: figure(import.meta.url, 1, "Code traceability audit summary"),
  description:
    "An audit that enumerates app code, reads ABB ownership from TS/JS and CSS comments, and resolves requirement coverage through the project graph. It validates links in memory before the Vite build without generating a ledger or shipping spec tooling in the browser bundle.",
  diagrams: [
    {
      title: "Traceability boundaries",
      language: "mermaid",
      source: `flowchart LR
  Audit[Source audit] --> Source[TS AST and CSS comments]
  Source --> Blocks[Annotated architecture blocks]
  Blocks -->|implements| Requirements[Requirement artifacts]
  Audit --> Inventory[In-memory inventory]`,
    },
  ],
  responsibilities: [
    "Enumerate source files and named callables independently of their annotations; inherit links only for inline callbacks.",
    "Require ABB ownership and derive requirements through implements relations, keeping optional direct requirement links distinct.",
    "Cross-check declared ABB files against source ownership, reject invalid annotations, and expose links directly with optional JSON on stdout and no persisted ledger.",
  ],
  files: ["specs/audit/code-audit.ts", "specs/audit/code-check.ts"],
});

export const codeTraceabilityAuditRelations = [
  implementsRequirement(codeTraceabilityAudit, codeTraceability),
] as const;
