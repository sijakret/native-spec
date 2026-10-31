import { verifies } from "../../definition/process.js";
import { artifact } from "../factory.js";
import { cdnApp } from "../requirements/001-cdn-app.nfr.js";
import { inventory } from "../requirements/001-inventory.sr.js";
import { manageStock } from "../requirements/001-manage-stock.mr.js";
import { codeTraceability } from "../requirements/002-code-traceability.nfr.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";
import { invalidStock } from "../risks/001-invalid-stock.risk.js";

export const stockroomSuite = artifact.testCase({
  id: "TC-001",
  title: "Stockroom Suite",
  type: "automated",
  code: [
    "tests/domain.test.ts",
    "tests/storage.test.ts",
    "specs/audit/code-audit.test.ts",
    "tests/deployment.test.ts",
  ],
  description:
    "Verify inventory rules, order transitions, persistence boundaries, CDN output, and exhaustive code links.",
  steps: [
    "Reserve, fulfill, cancel, restock, reload, and round-trip data.",
    "Try overselling, repeated transitions, malformed imports, stale tabs, and failed writes.",
    "Audit valid and deliberately uncovered source fixtures; inspect the production build.",
  ],
  expected: [
    "Stock remains consistent and errors preserve valid state.",
    "Missing code links fail and the built app keeps the pinned runtime CDN import.",
  ],
});

export const stockroomSuiteRelations = [
  verifies(stockroomSuite, manageStock, "single-app"),
  verifies(stockroomSuite, manageStock, "consistent-stock"),
  verifies(stockroomSuite, inventory, "search"),
  verifies(stockroomSuite, inventory, "availability"),
  verifies(stockroomSuite, inventory, "restock"),
  verifies(stockroomSuite, inventory, "overview"),
  verifies(stockroomSuite, orderLifecycle, "valid-order"),
  verifies(stockroomSuite, orderLifecycle, "reserve-stock"),
  verifies(stockroomSuite, orderLifecycle, "release-stock"),
  verifies(stockroomSuite, orderLifecycle, "closed-orders"),
  verifies(stockroomSuite, localData, "persist-workspace"),
  verifies(stockroomSuite, localData, "validate-data"),
  verifies(stockroomSuite, localData, "preserve-valid-state"),
  verifies(stockroomSuite, localData, "export-and-reset"),
  verifies(stockroomSuite, localData, "local-only"),
  verifies(stockroomSuite, localData, "stale-tabs"),
  verifies(stockroomSuite, cdnApp, "static-build"),
  verifies(stockroomSuite, cdnApp, "pinned-cdn"),
  verifies(stockroomSuite, cdnApp, "loading-failures"),
  verifies(stockroomSuite, codeTraceability, "enumerate-code"),
  verifies(stockroomSuite, codeTraceability, "requirement-links"),
  verifies(stockroomSuite, codeTraceability, "callback-inheritance"),
  verifies(stockroomSuite, codeTraceability, "reject-invalid-links"),
  verifies(stockroomSuite, codeTraceability, "app-boundary"),
  verifies(stockroomSuite, codeTraceability, "code-inventory"),
  verifies(stockroomSuite, invalidStock),
] as const;
