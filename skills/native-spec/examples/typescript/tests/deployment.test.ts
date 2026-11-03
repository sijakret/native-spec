import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { seedWorkspace } from "../src/domain.js";
import { importWorkspace, storageKey } from "../src/storage.js";

export type specBindings = {
  staticBuild: typeof staticBuild;
  browserNavigation: typeof browserNavigation;
  confirmedReset: typeof confirmedReset;
  browserLocalData: typeof browserLocalData;
  preservedState: typeof preservedState;
  loadingFailure: typeof loadingFailure;
};

function staticBuild() {
  const root = resolve(import.meta.dirname, "..");
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  const html = readFileSync(join(root, "dist/index.html"), "utf8");
  expect(html).toContain('src="./assets/');
  const scripts = readdirSync(join(root, "dist/assets"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(root, "dist/assets", name), "utf8"))
    .join("\n");
  expect(scripts).toContain("https://cdn.jsdelivr.net/npm/lit-html@3.3.1/+esm");
  expect(scripts).not.toContain("specs/artifacts");
  expect(scripts).not.toContain("privateByDefault");
  expect(scripts).not.toContain("StockDomainLinks");
  expect(scripts).not.toContain("InventoryDeskLinks");
  expect(scripts).not.toContain("BrowserStorageLinks");
  expect(scripts).not.toContain("Bindings");
  expect(scripts).not.toContain("Callable");
  expect(scripts).not.toContain("Constructable");
  expect(scripts).not.toContain("specBindings");
  expect(scripts).not.toContain("TestReferences");
  expect(scripts).not.toContain("testedBy");
  expect(scripts).not.toContain("seededInventory");
  expect(scripts).not.toContain("invalidQuantities");
  expect(scripts).not.toContain("vitest");
  expect(scripts).not.toContain("REQ-SR-");
  expect(scripts).not.toContain("ABB-");
  const styles = readdirSync(join(root, "dist/assets"))
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(root, "dist/assets", name), "utf8"))
    .join("\n");
  expect(styles).not.toContain("ABB-");
  expect(existsSync(join(root, "dist/code-inventory.json"))).toBe(false);
}

const rendererUrl = "https://cdn.jsdelivr.net/npm/lit-html@3.3.1/+esm";
let browser: JSDOM;

async function openApp() {
  await import("../src/main.js");
  await vi.waitFor(() =>
    expect(document.querySelector(".app-header")).not.toBeNull(),
  );
}

function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(found, text).toBeDefined();
  return found!;
}

async function browserNavigation() {
  await openApp();
  expect(document.querySelector("main h1")?.textContent).toContain(
    "clear view",
  );
  button("inventory").click();
  expect(document.querySelector("main h1")?.textContent).toContain(
    "Everything on the shelf",
  );
  expect(document.querySelectorAll("tbody tr")).toHaveLength(
    seedWorkspace().products.length,
  );
  button("orders").click();
  expect(document.querySelector("main h1")?.textContent).toContain(
    "promise you can keep",
  );
  expect(document.querySelector('form input[name="customer"]')).not.toBeNull();
  button("overview").click();
  expect(document.querySelector("main h1")?.textContent).toContain(
    "clear view",
  );
}

async function confirmedReset() {
  const seeded = seedWorkspace();
  const changed = {
    ...seeded,
    products: seeded.products.map((product, index) =>
      index === 0 ? { ...product, onHand: 1 } : product,
    ),
  };
  window.localStorage.setItem(storageKey, JSON.stringify(changed));
  await openApp();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const saved = window.localStorage.getItem(storageKey);
  button("Reset demo").click();
  expect(confirm).toHaveBeenCalledOnce();
  expect(window.localStorage.getItem(storageKey)).toBe(saved);
  confirm.mockReturnValue(true);
  button("Reset demo").click();
  expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toEqual(
    seedWorkspace(),
  );
  expect(document.querySelector('[role="status"]')?.textContent).toContain(
    "Demo reset",
  );
}

async function browserLocalData() {
  const fetch = vi.fn();
  const transmit = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("XMLHttpRequest", transmit);
  vi.stubGlobal("WebSocket", transmit);
  const beacon = vi.fn();
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: beacon,
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  await openApp();
  const saved = window.localStorage.getItem(storageKey)!;
  expect(JSON.parse(saved)).toEqual(seedWorkspace());
  expect(document.querySelector("footer")?.textContent).toContain(
    "unencrypted",
  );
  button("inventory").click();
  const form = document.querySelector<HTMLFormElement>("form.inline-form")!;
  form.querySelector<HTMLInputElement>('input[name="quantity"]')!.value = "2";
  form.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  const changed = window.localStorage.getItem(storageKey)!;
  expect(importWorkspace(changed).products[0]?.onHand).toBe(
    seedWorkspace().products[0]!.onHand + 2,
  );
  const download = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:stockroom-export");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(
    browser.window.HTMLAnchorElement.prototype,
    "click",
  ).mockImplementation(() => {});
  button("Export JSON").click();
  const blob = download.mock.calls[0]?.[0] as Blob;
  expect(importWorkspace(await blob.text())).toEqual(importWorkspace(changed));
  expect(revoke).toHaveBeenCalledWith("blob:stockroom-export");
  expect(fetch).not.toHaveBeenCalled();
  expect(transmit).not.toHaveBeenCalled();
  expect(beacon).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
}

async function preservedState() {
  await openApp();
  const saved = window.localStorage.getItem(storageKey);
  button("inventory").click();
  const row = document.querySelector("tbody tr")!.textContent;
  const form = document.querySelector<HTMLFormElement>("form.inline-form")!;
  form.querySelector<HTMLInputElement>('input[name="quantity"]')!.value = "3";
  vi.spyOn(browser.window.Storage.prototype, "setItem").mockImplementationOnce(
    () => {
      throw new Error("Quota exceeded");
    },
  );
  form.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Quota exceeded",
  );
  expect(window.localStorage.getItem(storageKey)).toBe(saved);
  expect(document.querySelector("tbody tr")!.textContent).toBe(row);
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    value: [{ size: 20, text: async () => "{broken" }],
  });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await vi.waitFor(() =>
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "JSON",
    ),
  );
  expect(window.localStorage.getItem(storageKey)).toBe(saved);
  expect(document.querySelector("tbody tr")!.textContent).toBe(row);
}

async function loadingFailure() {
  vi.doMock(rendererUrl, () => {
    throw new Error("CDN offline");
  });
  await import("../src/main.js");
  await vi.waitFor(() =>
    expect(document.getElementById("app")?.textContent).toContain(
      "Unable to load the CDN renderer",
    ),
  );
  expect(document.getElementById("app")?.getAttribute("role")).toBe("alert");
  expect(document.getElementById("app")?.textContent).toContain(
    "allow cdn.jsdelivr.net",
  );
}

describe("CDN-based deployment", () => {
  it(
    "builds relative static assets and retains the pinned runtime CDN import",
    staticBuild,
  );
});

describe("browser acceptance criteria", () => {
  beforeAll(() => {
    browser = new JSDOM('<div id="app"></div>', {
      url: "https://stockroom.test/",
    });
  });
  beforeEach(() => {
    vi.resetModules();
    for (const name of [
      "window",
      "document",
      "HTMLFormElement",
      "HTMLInputElement",
      "HTMLButtonElement",
      "FormData",
    ] as const)
      vi.stubGlobal(name, browser.window[name]);
    browser.window.document.body.innerHTML = '<div id="app"></div>';
    browser.window.localStorage.clear();
    vi.doMock(rendererUrl, async () => import("lit-html"));
  });
  afterEach(() => {
    vi.doUnmock(rendererUrl);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterAll(() => browser.window.close());
  it(
    "navigates inventory, orders, and overview within one app",
    browserNavigation,
  );
  it("requires confirmation before resetting local data", confirmedReset);
  it(
    "persists and exports locally without transmitting or logging workspace data",
    browserLocalData,
  );
  it(
    "shows import/write failures without replacing valid state",
    preservedState,
  );
  it("shows an actionable error when the CDN renderer fails", loadingFailure);
});
