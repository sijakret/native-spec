import {
  figure,
  implementsRequirement,
  type Implementation,
} from "../../definition/process.js";
import type * as storage from "../../../src/storage.js";
import { artifact } from "../factory.js";
import { localData } from "../requirements/003-local-data.sr.js";

export const browserStorage = artifact.architectureBlock({
  id: "ABB-002",
  title: "Validated Browser Storage",
  tags: ["browser", "persistence"],
  summaryDiagram: figure(import.meta.url, 1, "Browser storage summary"),
  description:
    "The only boundary to localStorage and JSON files. Data is validated by the domain on every load and import, and written before the UI adopts it, so a failed write never shows unsaved state.",
  diagrams: [
    {
      title: "Persistence boundary",
      language: "mermaid",
      source: `flowchart LR
  UI[Inventory desk UI] -->|next workspace| Save[Validate and write]
  Save --> Local[(localStorage)]
  Local --> Load[Load and validate]
  File[JSON backup] <-->|import / export| Load
  Load -->|valid workspace or error| UI`,
    },
  ],
  responsibilities: [
    "Load, save, import, and export workspaces through domain validation.",
    "Reject corrupt stored data without overwriting it, refuse to save over another tab's changes, and surface write failures such as quota errors.",
  ],
});

export type BrowserStorageImplementation = Implementation<
  typeof browserStorage,
  [
    typeof storage,
    typeof storage.importWorkspace,
    typeof storage.exportWorkspace,
    typeof storage.WorkspaceStore,
    storage.WorkspaceStore["load"],
    storage.WorkspaceStore["save"],
  ]
>;

export const browserStorageRelations = [
  implementsRequirement(browserStorage, localData),
] as const;
