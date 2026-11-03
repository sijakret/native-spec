import { artifact } from "../factory.js";
import { testedBy } from "../../definition/process.js";
import type * as domainTests from "../../../tests/domain.test.js";
import type * as deploymentTests from "../../../tests/deployment.test.js";

export const manageStock = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Manage Stock Without Overselling",
  tags: ["stockroom"],
  description:
    "A single operator can see available inventory and deliver orders without allocating the same stock twice.",
  acceptanceCriteria: [
    {
      id: "single-app",
      description:
        "Inventory, orders, and an overview are available in one browser app.",
      tests: testedBy<[deploymentTests.specBindings["browserNavigation"]]>(),
    },
    {
      id: "consistent-stock",
      description:
        "Confirming, fulfilling, and cancelling orders keep stock consistent.",
      tests:
        testedBy<
          [
            domainTests.specBindings["reservations"],
            domainTests.specBindings["fulfillments"],
            domainTests.specBindings["cancellations"],
          ]
        >(),
    },
  ],
});
