import { threatens } from "../../definition/process.js";
import { artifact } from "../factory.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";

export const invalidStock = artifact.risk({
  id: "RISK-001",
  title: "Invalid or Lost Stock State",
  level: "high",
  tags: ["integrity"],
  description:
    "Malformed imports, stale tabs, or repeated transitions could overwrite inventory or oversell stock.",
  mitigation: [
    "Validate complete state at persistence and import boundaries.",
    "Derive reservations from open orders and reject closed-order transitions.",
    "Detect changed storage before writing and document that this is not a concurrent multi-user system.",
  ],
  impact: "The operator could promise unavailable stock or lose valid data.",
});

export const invalidStockRelations = [
  threatens(invalidStock, orderLifecycle),
  threatens(invalidStock, localData),
] as const;
