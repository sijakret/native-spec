import { architectureFigure, figure } from "../../definition/process.js";
import { stockDomain } from "./001-stock-domain.abb.js";
import { browserStorage } from "./002-browser-storage.abb.js";
import { inventoryDesk } from "./003-inventory-desk.abb.js";
import { codeTraceabilityAudit } from "./004-code-traceability.abb.js";

export const architectureOverview = {
  description:
    "A single-user inventory and order desk: see stock, reserve orders, and fulfill without overselling. The inventory desk delegates stock and order operations to a pure, immutable domain model. Validated browser storage loads and commits whole workspaces, using the same domain rules to reject invalid persisted or imported data. These three blocks run entirely in the browser; the code traceability audit is a separate development and build-time block, not a runtime dependency. The system diagram includes the operator, runtime CDN, browser storage, JSON backups, and build-time source inspection; each building block has its own summary below.",
  intendedUses: [
    "Review product stock, receive stock, and spot low-stock items at a single-user inventory desk.",
    "Reserve, fulfill, or cancel single-product orders without overselling available stock.",
    "Demonstrate the workflow in one browser, using JSON import/export for backup or transfer; not a shared, multi-user stock system.",
  ],
  diagrams: [
    architectureFigure(figure(import.meta.url, 1, "Architecture overview"), [
      stockDomain,
      browserStorage,
      inventoryDesk,
      codeTraceabilityAudit,
    ]),
  ],
} as const;
