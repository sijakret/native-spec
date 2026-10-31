import { artifact } from "../factory.js";

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
    },
    {
      id: "consistent-stock",
      description:
        "Confirming, fulfilling, and cancelling orders keep stock consistent.",
    },
  ],
});
