import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CDN-based deployment", () => {
  it("builds relative static assets and retains the pinned runtime CDN import", () => {
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
    expect(scripts).toContain(
      "https://cdn.jsdelivr.net/npm/lit-html@3.3.1/+esm",
    );
    expect(scripts).not.toContain("specs/artifacts");
    expect(scripts).not.toContain("privateByDefault");
    expect(scripts).not.toContain("StockDomainHelpers");
    expect(scripts).not.toContain("InventoryDeskImplementation");
    expect(scripts).not.toContain("REQ-SR-");
    expect(scripts).not.toContain("ABB-");
    const styles = readdirSync(join(root, "dist/assets"))
      .filter((name) => name.endsWith(".css"))
      .map((name) => readFileSync(join(root, "dist/assets", name), "utf8"))
      .join("\n");
    expect(styles).not.toContain("ABB-");
    expect(existsSync(join(root, "dist/code-inventory.json"))).toBe(false);
  });
});
