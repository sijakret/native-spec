import { delivers } from "../../definition/process.js";
import { stockDomain } from "../architecture/001-stock-domain.abb.js";
import { browserStorage } from "../architecture/002-browser-storage.abb.js";
import { inventoryDesk } from "../architecture/003-inventory-desk.abb.js";
import { codeTraceabilityAudit } from "../architecture/004-code-traceability.abb.js";
import { artifact } from "../factory.js";
import { cdnApp } from "../requirements/001-cdn-app.nfr.js";
import { inventory } from "../requirements/001-inventory.sr.js";
import { manageStock } from "../requirements/001-manage-stock.mr.js";
import { codeTraceability } from "../requirements/002-code-traceability.nfr.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";
import { invalidStock } from "../risks/001-invalid-stock.risk.js";
import { stockroomSuite } from "../tests/001-stockroom-suite.tc.js";

export const firstSliceSprint = artifact.sprint({
  id: "SPRINT-0001",
  title: "Stockroom First Slice",
  status: "completed",
  description:
    "Replace the unimplemented notes template with a lean, working stockroom and exhaustive app-code traceability.",
  diagrams: [
    {
      title: "Reserve and persist an order",
      language: "mermaid",
      source: `sequenceDiagram
  Operator->>UI: Reserve stock
  UI->>Domain: Validate order and availability
  Domain-->>UI: Next immutable state
  UI->>Storage: Validate and persist
  UI-->>Operator: Updated inventory and order`,
    },
  ],
  verification: [
    "npm test and npm run build pass across domain, storage, deployment, process invariants, viewer, and annotation-audit fixtures.",
    "Source annotation audit: 5 source files, 38 ABB-owned named callables, and 34 inherited callbacks; requirements resolve through the architecture graph, with optional JSON on stdout and no generated ledger.",
    "Production browser checks: inventory search and receipts, reservation/fulfillment/cancellation, overselling rejection, reload, valid/invalid import, export, and confirmed/cancelled reset.",
    "Recovery checks: corrupt data is preserved, quota and stale-tab errors do not adopt unsaved state, CDN failure is actionable, and all three views avoid document overflow at desktop and mobile widths.",
  ],
  tasks: [
    {
      text: "Define Stockroom requirements, deployment, code coverage, and integrity risk.",
      done: true,
    },
    {
      text: "Implement and test the browser app and domain invariants.",
      done: true,
    },
    {
      text: "Enforce exhaustive source inventory and requirement links in the build.",
      done: true,
    },
    { text: "Verify production build and browser workflows.", done: true },
  ],
  implementation: [
    "Immutable stock and order rules, validated local persistence, and a Vite UI with a pinned runtime CDN renderer.",
    "Source-owned ABB annotations with graph-derived requirement coverage, independent TypeScript AST enumeration, and CSS comment parsing; audits and invariant tests live under specs/audit, and spec tooling stays outside the browser bundle.",
  ],
  architectureReview: [
    {
      text: "Reviewed ABB-001: the domain owns stock invariants and derives reservations from open orders.",
      done: true,
    },
    {
      text: "Reviewed ABB-002: storage validates every load and import and commits before the UI adopts state.",
      done: true,
    },
    {
      text: "Reviewed ABB-003: the UI stays thin, loads lit-html from the pinned CDN, and renders only committed state.",
      done: true,
    },
    {
      text: "Reviewed ABB-004: the build audits app code separately and keeps spec tooling out of the bundle.",
      done: true,
    },
  ],
  documentationIntegrity: [
    {
      text: "Replaced notes documentation, checked artifact links, and recorded implementation and validation results.",
      done: true,
    },
  ],
});

export const firstSliceSprintRelations = [
  delivers(firstSliceSprint, manageStock),
  delivers(firstSliceSprint, inventory),
  delivers(firstSliceSprint, orderLifecycle),
  delivers(firstSliceSprint, localData),
  delivers(firstSliceSprint, cdnApp),
  delivers(firstSliceSprint, codeTraceability),
  delivers(firstSliceSprint, stockDomain),
  delivers(firstSliceSprint, browserStorage),
  delivers(firstSliceSprint, inventoryDesk),
  delivers(firstSliceSprint, codeTraceabilityAudit),
  delivers(firstSliceSprint, stockroomSuite),
  delivers(firstSliceSprint, invalidStock),
] as const;
