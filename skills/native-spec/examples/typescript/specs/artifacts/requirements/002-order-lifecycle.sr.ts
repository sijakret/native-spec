import { derivesFrom, testedBy } from "../../definition/process.js";
import type * as domainTests from "../../../tests/domain.test.js";
import { orderStates } from "../architecture/figures/001-stock-domain.figures.js";
import { artifact } from "../factory.js";
import { manageStock } from "./001-manage-stock.mr.js";

export const orderLifecycle = artifact.softwareRequirement({
  id: "REQ-SR-002",
  title: "Order Reservations",
  tags: ["orders"],
  description: `Each order contains one product and transitions from reserved to fulfilled or cancelled (see ${orderStates.ref}).`,
  acceptanceCriteria: [
    {
      id: "valid-order",
      description:
        "Creating an order requires a customer and positive safe-integer quantity no greater than available stock.",
      tests:
        testedBy<
          [
            domainTests.specBindings["validOrders"],
            domainTests.specBindings["invalidQuantities"],
            domainTests.specBindings["overselling"],
          ]
        >(),
    },
    {
      id: "reserve-stock",
      description:
        "Creating an order reserves stock immediately without reducing on-hand stock.",
      tests: testedBy<[domainTests.specBindings["reservations"]]>(),
    },
    {
      id: "release-stock",
      description:
        "Cancellation releases the reservation exactly once; fulfillment reduces on-hand stock and releases the reservation.",
      tests:
        testedBy<
          [
            domainTests.specBindings["cancellations"],
            domainTests.specBindings["fulfillments"],
          ]
        >(),
    },
    {
      id: "closed-orders",
      description:
        "Closed orders cannot be edited or transitioned again. Failed operations leave state unchanged.",
      tests:
        testedBy<
          [
            domainTests.specBindings["cancellations"],
            domainTests.specBindings["fulfillments"],
            domainTests.specBindings["invalidQuantities"],
          ]
        >(),
    },
  ],
});

export const orderLifecycleRelations = [
  derivesFrom(orderLifecycle, manageStock),
] as const;
