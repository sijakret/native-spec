import {
  orderStates,
  stockDomain,
  stockDomainRelations,
} from "./architecture/001-stock-domain.abb.js";
import {
  browserStorage,
  browserStorageRelations,
} from "./architecture/002-browser-storage.abb.js";
import {
  inventoryDesk,
  inventoryDeskRelations,
} from "./architecture/003-inventory-desk.abb.js";
import {
  codeTraceabilityAudit,
  codeTraceabilityAuditRelations,
} from "./architecture/004-code-traceability.abb.js";
import { manageStock } from "./requirements/001-manage-stock.mr.js";
import {
  inventory,
  inventoryRelations,
} from "./requirements/001-inventory.sr.js";
import {
  orderLifecycle,
  orderLifecycleRelations,
} from "./requirements/002-order-lifecycle.sr.js";
import {
  localData,
  localDataRelations,
} from "./requirements/003-local-data.sr.js";
import { cdnApp } from "./requirements/001-cdn-app.nfr.js";
import { codeTraceability } from "./requirements/002-code-traceability.nfr.js";
import {
  invalidStock,
  invalidStockRelations,
} from "./risks/001-invalid-stock.risk.js";
import {
  firstSliceSprint,
  firstSliceSprintRelations,
} from "./sprints/0001-first-slice.sprint.js";

export {
  stockDomain,
  browserStorage,
  inventoryDesk,
  codeTraceabilityAudit,
  manageStock,
  inventory,
  orderLifecycle,
  localData,
  cdnApp,
  codeTraceability,
  invalidStock,
  firstSliceSprint,
  orderStates,
};

export const artifacts = [
  manageStock,
  inventory,
  orderLifecycle,
  localData,
  cdnApp,
  codeTraceability,
  stockDomain,
  browserStorage,
  inventoryDesk,
  codeTraceabilityAudit,
  invalidStock,
  firstSliceSprint,
] as const;

export const relations = [
  ...inventoryRelations,
  ...orderLifecycleRelations,
  ...localDataRelations,
  ...stockDomainRelations,
  ...browserStorageRelations,
  ...inventoryDeskRelations,
  ...codeTraceabilityAuditRelations,
  ...invalidStockRelations,
  ...firstSliceSprintRelations,
] as const;
