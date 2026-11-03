import {
  figure,
  implementsRequirement,
  type Bindings,
  type Implementation,
} from "../../definition/process.js";
import type * as domain from "../../../src/domain.js";
import { artifact } from "../factory.js";
import { inventory } from "../requirements/001-inventory.sr.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";
import { orderStates } from "./001-stock-domain.figures.js";

export { orderStates } from "./001-stock-domain.figures.js";

export const stockDomain = artifact.architectureBlock({
  id: "ABB-001",
  title: "Stock and Order Domain",
  tags: ["domain"],
  summaryDiagram: figure(import.meta.url, 2, "Stock and order domain summary"),
  description:
    "Pure, immutable operations over the workspace. Reservations are derived from open orders, so available stock is never stored and cannot drift; every operation returns a new workspace or throws without changing state.",
  diagrams: [orderStates],
  responsibilities: [
    "Validate products, orders, and quantities; reject overselling and repeated or invalid transitions.",
    "Derive reserved and available stock from open orders and summarize low stock.",
    "Validate whole workspaces so storage and import share one definition of valid data.",
  ],
});

export interface StockDomainLinks extends Implementation<
  typeof stockDomain,
  [
    typeof domain,
    typeof domain.seedWorkspace,
    typeof domain.quantity,
    typeof domain.validateWorkspace,
    typeof domain.reservedFor,
    typeof domain.availableFor,
    typeof domain.restock,
    typeof domain.reserveOrder,
    typeof domain.closeOrder,
    typeof domain.searchProducts,
    typeof domain.stockSummary,
  ]
> {
  readonly contract: {
    record: object;
    text: object;
    parseProduct: object;
    parseOrder: object;
    unique: object;
  };
  readonly bindings: Bindings<StockDomainLinks["contract"], domain.local>;
}

export const stockDomainRelations = [
  implementsRequirement(stockDomain, inventory),
  implementsRequirement(stockDomain, orderLifecycle),
  implementsRequirement(stockDomain, localData),
] as const;
