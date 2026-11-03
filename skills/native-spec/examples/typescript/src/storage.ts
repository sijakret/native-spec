import type { Bindings } from "../specs/definition/process.js";
import type { BrowserStorageLinks } from "../specs/artifacts/architecture/002-browser-storage.abb.js";
import { seedWorkspace, validateWorkspace, type Workspace } from "./domain.js";

export type specBindings = Bindings<
  BrowserStorageLinks["contract"],
  {
    importWorkspace: typeof importWorkspace;
    exportWorkspace: typeof exportWorkspace;
    WorkspaceStore: typeof WorkspaceStore;
    load: WorkspaceStore["load"];
    save: WorkspaceStore["save"];
  }
>;

export const storageKey = "acme-stockroom:v1";
export type StoragePort = Pick<Storage, "getItem" | "setItem">;

export function importWorkspace(source: string): Workspace {
  return validateWorkspace(JSON.parse(source));
}

export function exportWorkspace(state: Workspace): string {
  return JSON.stringify(validateWorkspace(state), null, 2);
}

export class WorkspaceStore {
  private snapshot: string | null | undefined;

  constructor(private readonly storage: StoragePort) {}

  load(): Workspace {
    this.snapshot = this.storage.getItem(storageKey);
    if (this.snapshot !== null) return importWorkspace(this.snapshot);
    const seed = seedWorkspace();
    this.save(seed);
    return seed;
  }

  save(state: Workspace): void {
    const encoded = exportWorkspace(state);
    if (this.snapshot === undefined)
      throw new Error("Load the workspace before saving.");
    if (this.storage.getItem(storageKey) !== this.snapshot)
      throw new Error(
        "Workspace changed in another tab. Reload before saving.",
      );
    this.storage.setItem(storageKey, encoded);
    this.snapshot = encoded;
  }
}
