import { derivesFrom, testedBy } from "../../definition/process.js";
import type * as domainTests from "../../../tests/domain.test.js";
import { artifact } from "../factory.js";
import { manageStock } from "./001-manage-stock.mr.js";

export const inventory = artifact.softwareRequirement({
  id: "REQ-SR-001",
  title: "Inventory and Overview",
  tags: ["inventory"],
  description:
    "Show seeded products, stock availability, low-stock indicators, and recent orders.",
  acceptanceCriteria: [
    {
      id: "search",
      description:
        "Search matches product names and SKUs without case sensitivity.",
      tests: testedBy<[domainTests.specBindings["seededInventory"]]>(),
    },
    {
      id: "availability",
      description:
        "Available stock is on-hand stock minus open-order reservations; low stock means available is at or below the product threshold.",
      tests: testedBy<[
        domainTests.specBindings["seededInventory"],
        domainTests.specBindings["reservations"],
      ]>(),
    },
    {
      id: "restock",
      description:
        "Restocking accepts only positive safe-integer quantities, without overflow.",
      tests: testedBy<[
        domainTests.specBindings["restocking"],
        domainTests.specBindings["invalidQuantities"],
      ]>(),
    },
    {
      id: "overview",
      description:
        "The overview totals on-hand, reserved, and available stock and shows recent orders.",
      tests: testedBy<[
        domainTests.specBindings["seededInventory"],
        domainTests.specBindings["reservations"],
      ]>(),
    },
  ],
});

export const inventoryRelations = [
  derivesFrom(inventory, manageStock),
] as const;
