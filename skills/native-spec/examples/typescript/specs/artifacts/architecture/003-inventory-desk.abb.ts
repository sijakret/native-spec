import { figure, implementsRequirement } from "../../definition/process.js";
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
  files: ["src/main.ts", "src/styles.css", "src/cdn.d.ts"],
});

export const inventoryDeskRelations = [
  implementsRequirement(inventoryDesk, inventory),
  implementsRequirement(inventoryDesk, orderLifecycle),
  implementsRequirement(inventoryDesk, cdnApp),
  implementsRequirement(inventoryDesk, localData),
] as const;
