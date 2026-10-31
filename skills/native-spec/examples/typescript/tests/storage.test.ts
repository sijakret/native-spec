import { beforeEach, describe, expect, it, vi } from "vitest";
import { reserveOrder, seedWorkspace } from "../src/domain.js";
import { exportWorkspace, importWorkspace, storageKey, WorkspaceStore } from "../src/storage.js";

describe("local persistence", () => {
  let data: Map<string, string>;
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
  };
  beforeEach(() => {
    data = new Map();
    vi.clearAllMocks();
  });

  it("seeds once and reloads a persisted order", () => {
    const store = new WorkspaceStore(storage);
    const seed = store.load();
    const state = reserveOrder(seed, { customer: "North", productId: "p-1", quantity: 2 }, "o-1", "2026-10-29T10:00:00.000Z");
    store.save(state);
    expect(new WorkspaceStore(storage).load()).toEqual(state);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it("round-trips JSON and discards unmodeled fields", () => {
    expect(importWorkspace(exportWorkspace(seedWorkspace()))).toEqual(seedWorkspace());
    const value = { ...seedWorkspace(), injected: "<script>" };
    expect(importWorkspace(JSON.stringify(value))).not.toHaveProperty("injected");
  });

  it("does not overwrite invalid saved data or silently seed a new workspace", () => {
    data.set(storageKey, "{broken");
    const store = new WorkspaceStore(storage);
    expect(() => store.load()).toThrow();
    expect(data.get(storageKey)).toBe("{broken");
    expect(storage.setItem).not.toHaveBeenCalled();
    store.save(seedWorkspace());
    expect(new WorkspaceStore(storage).load()).toEqual(seedWorkspace());
  });

  it("rejects stale-tab writes", () => {
    const first = new WorkspaceStore(storage);
    const second = new WorkspaceStore(storage);
    const state = first.load();
    second.load();
    first.save(reserveOrder(state, { customer: "North", productId: "p-1", quantity: 1 }, "o-1", "2026-10-29T10:00:00.000Z"));
    const saved = data.get(storageKey);
    expect(() => second.save(state)).toThrow("another tab");
    expect(data.get(storageKey)).toBe(saved);
  });

  it("surfaces quota failures and can retry without losing the previous snapshot", () => {
    const store = new WorkspaceStore(storage);
    const state = store.load();
    const saved = data.get(storageKey);
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota exceeded"); });
    expect(() => store.save(state)).toThrow("Quota exceeded");
    expect(data.get(storageKey)).toBe(saved);
    expect(() => store.save(state)).not.toThrow();
  });

  it("surfaces disabled storage and rejects saving before loading", () => {
    storage.getItem.mockImplementationOnce(() => { throw new Error("Storage blocked"); });
    expect(() => new WorkspaceStore(storage).load()).toThrow("Storage blocked");
    expect(() => new WorkspaceStore(storage).save(seedWorkspace())).toThrow("Load");
  });

  it("validates before any write", () => {
    const store = new WorkspaceStore(storage);
    store.load();
    const saved = data.get(storageKey);
    expect(() => importWorkspace('{"version":1,"products":[],"orders":[{}]}')).toThrow();
    expect(() => store.save({ ...seedWorkspace(), version: 2 } as never)).toThrow();
    expect(data.get(storageKey)).toBe(saved);
  });
});
