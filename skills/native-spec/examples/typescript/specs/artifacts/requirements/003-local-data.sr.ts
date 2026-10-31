import { derivesFrom } from "../../definition/process.js";
import { artifact } from "../factory.js";
import { manageStock } from "./001-manage-stock.mr.js";

export const localData = artifact.softwareRequirement({
  id: "REQ-SR-003",
  title: "Local Data and Portability",
  tags: ["persistence"],
  description:
    "Persist a single-user workspace locally, with validated JSON import, export, and a confirmed demo reset.",
  acceptanceCriteria: [
    {
      id: "persist-workspace",
      description:
        "A fresh workspace starts with sample inventory; successful changes survive reload.",
    },
    {
      id: "validate-data",
      description:
        "Imports and saved data validate version, field types, unique IDs, product references, safe-integer quantities, and reservation limits.",
    },
    {
      id: "preserve-valid-state",
      description:
        "Invalid data and failed writes show an error without replacing the current valid state or corrupting stored data.",
    },
    {
      id: "export-and-reset",
      description:
        "Export produces a re-importable JSON workspace; reset requires confirmation.",
    },
    {
      id: "local-only",
      description:
        "Data is unencrypted and stays in this browser; no stockroom data is logged, telemetered, or transmitted.",
    },
    {
      id: "stale-tabs",
      description:
        "A stale tab cannot overwrite another tab's changes without reloading.",
    },
  ],
});

export const localDataRelations = [
  derivesFrom(localData, manageStock),
] as const;
