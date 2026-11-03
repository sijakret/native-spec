import {
  figure,
  implementsRequirement,
  type Bindings,
  type Callable,
  type Implementation,
} from "../../definition/process.js";
import type * as domain from "../../../src/domain.js";
import { artifact } from "../factory.js";
import { inventory } from "../requirements/001-inventory.sr.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";
import { orderStates } from "./figures/001-stock-domain.figures.js";

export { orderStates } from "./figures/001-stock-domain.figures.js";

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
  [typeof domain]
> {
  readonly contract: {
    seedWorkspace: Callable<typeof domain.seedWorkspace>;
    quantity: Callable<typeof domain.quantity>;
    validateWorkspace: Callable<typeof domain.validateWorkspace>;
    reservedFor: Callable<typeof domain.reservedFor>;
    availableFor: Callable<typeof domain.availableFor>;
    restock: Callable<typeof domain.restock>;
    reserveOrder: Callable<typeof domain.reserveOrder>;
    closeOrder: Callable<typeof domain.closeOrder>;
    searchProducts: Callable<typeof domain.searchProducts>;
    stockSummary: Callable<typeof domain.stockSummary>;
    record: Callable<domain.specBindings["record"]>;
    text: Callable<domain.specBindings["text"]>;
    parseProduct: Callable<domain.specBindings["parseProduct"]>;
    parseOrder: Callable<domain.specBindings["parseOrder"]>;
    unique: Callable<domain.specBindings["unique"]>;
  };
  readonly specBindings: Bindings<
    StockDomainLinks["contract"],
    domain.specBindings
  >;
}

export const stockDomainRelations = [
  implementsRequirement(stockDomain, inventory),
  implementsRequirement(stockDomain, orderLifecycle),
  implementsRequirement(stockDomain, localData),
] as const;
