import {
  figure,
  implementsRequirement,
  type Bindings,
  type Callable,
  type Implementation,
} from "../../definition/process.js";
import type * as desk from "../../../src/main.js";
import { artifact } from "../factory.js";
import { cdnApp } from "../requirements/001-cdn-app.nfr.js";
import { inventory } from "../requirements/001-inventory.sr.js";
import { orderLifecycle } from "../requirements/002-order-lifecycle.sr.js";
import { localData } from "../requirements/003-local-data.sr.js";

export const inventoryDesk = artifact.architectureBlock({
  id: "ABB-003",
  title: "Inventory Desk UI",
  tags: ["browser", "ui"],
  summaryDiagram: figure(import.meta.url, 1, "Inventory desk summary"),
  description:
    "A thin lit-html interface loaded from a pinned runtime CDN. It turns operator input into domain operations, persists the result through storage, and renders only state that was committed.",
  diagrams: [
    {
      title: "Runtime boundaries",
      language: "mermaid",
      source: `flowchart LR
  CDN["jsDelivr: lit-html 3.3.1"] -. runtime module .-> UI[Inventory desk UI]
  UI --> Domain[Stock and order domain]
  UI --> Storage[Validated browser storage]`,
    },
  ],
  responsibilities: [
    "Render overview, inventory, and order views and route operator actions to the domain.",
    "Adopt a new workspace only after storage has committed it; show actionable errors otherwise.",
    "Load the renderer from the pinned CDN and fail visibly when it is unavailable.",
  ],
  files: ["src/styles.css", "src/cdn.d.ts"],
});

export interface InventoryDeskLinks extends Implementation<
  typeof inventoryDesk,
  [typeof desk]
> {
  readonly contract: {
    currentState: Callable<desk.specBindings["currentState"]>;
    errorText: Callable<desk.specBindings["errorText"]>;
    perform: Callable<desk.specBindings["perform"]>;
    formValues: Callable<desk.specBindings["formValues"]>;
    onRestock: Callable<desk.specBindings["onRestock"]>;
    onReserve: Callable<desk.specBindings["onReserve"]>;
    onCloseOrder: Callable<desk.specBindings["onCloseOrder"]>;
    onNavigate: Callable<desk.specBindings["onNavigate"]>;
    onSearch: Callable<desk.specBindings["onSearch"]>;
    onReset: Callable<desk.specBindings["onReset"]>;
    onExport: Callable<desk.specBindings["onExport"]>;
    onImport: Callable<desk.specBindings["onImport"]>;
    orderTable: Callable<desk.specBindings["orderTable"]>;
    overviewPage: Callable<desk.specBindings["overviewPage"]>;
    inventoryPage: Callable<desk.specBindings["inventoryPage"]>;
    ordersPage: Callable<desk.specBindings["ordersPage"]>;
    draw: Callable<desk.specBindings["draw"]>;
    boot: Callable<desk.specBindings["boot"]>;
  };
  readonly specBindings: Bindings<
    InventoryDeskLinks["contract"],
    desk.specBindings
  >;
}

export const inventoryDeskRelations = [
  implementsRequirement(inventoryDesk, inventory),
  implementsRequirement(inventoryDesk, orderLifecycle),
  implementsRequirement(inventoryDesk, cdnApp),
  implementsRequirement(inventoryDesk, localData),
] as const;
