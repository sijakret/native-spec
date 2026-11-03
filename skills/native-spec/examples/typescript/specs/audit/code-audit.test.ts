import { describe, expect, it } from "vitest";
import {
  browserStorage as storageDefinition,
  inventory,
  orderLifecycle,
  stockDomain as domainDefinition,
} from "../artifacts/index.js";
import {
  implementsRequirement,
  type SpecProject,
} from "../definition/process.js";
import { auditSources } from "./code-audit.js";

const stockDomain = { ...domainDefinition, files: undefined };
const browserStorage = { ...storageDefinition, files: undefined };

const project: SpecProject = {
  id: inventory.project,
  title: "Native symbol fixtures",
  artifacts: [stockDomain, browserStorage, inventory, orderLifecycle],
  relations: [
    implementsRequirement(stockDomain, inventory),
    implementsRequirement(browserStorage, orderLifecycle),
  ],
};
const declarations = `
  import type { Implementation as Links, ArchitectureBlock } from "./definition/process.js";
  import type * as app from "../src/app.js";
  declare const domain: ArchitectureBlock<"acme-stockroom", "ABB-001">;
  declare const storage: ArchitectureBlock<"acme-stockroom", "ABB-002">;
`;
function audit(source: string, targets: string, owner = "typeof domain") {
  return auditSources(
    new Map([["src/app.ts", source]]),
    project,
    new Map([
      [
        "specs/links.ts",
        `${declarations}
      export type Ownership = Links<${owner}, [${targets === "typeof app" ? targets : `typeof app, ${targets}`}]>;
    `,
      ],
    ]),
  );
}

describe("native implementation links", () => {
  it("resolves imported functions and derives requirements through ABB relations", () => {
    const result = audit(
      "export function reserve() { return [1].map(value => value + 1); }",
      "typeof app.reserve",
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(3);
    for (const entry of result.inventory) {
      expect(entry.architectureBlocks).toEqual([stockDomain.id]);
      expect(entry.requirements).toEqual([inventory.id]);
    }
    expect(result.inventory[2].inheritedFrom).toBe("src/app.ts#reserve");
  });

  it("supports multiple ABB owners without duplicated requirements", () => {
    const result = audit(
      "export function shared() {}",
      "typeof app.shared",
      "typeof domain | typeof storage",
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory[1].architectureBlocks).toEqual([
      stockDomain.id,
      browserStorage.id,
    ]);
    expect(result.inventory[1].requirements).toEqual([
      inventory.id,
      orderLifecycle.id,
    ]);
  });

  it("does not mistake module ownership for named-callable coverage", () => {
    const result = audit("export function missing() {}", "typeof app");
    expect(result.errors).toContain(
      "Missing architecture link: src/app.ts#missing",
    );
  });

  it("resolves constructors, methods, getters, and assigned functions", () => {
    const result = audit(
      `
      export class Store {
        constructor() {}
        load() { return 1; }
        get value() { return 1; }
        set value(next: number) {}
        change = () => 1;
        static save() {}
      }
      export const tools = { run() {}, arrow: () => 1 };
      export const assigned = (function named() {});
    `,
      `typeof app.Store, app.Store["load"], app.Store["value"],
      app.Store["change"], typeof app.Store.save,
      typeof app.tools.run, typeof app.tools.arrow, typeof app.assigned`,
    );
    expect(result.errors).toEqual([]);
    expect(
      result.inventory
        .filter((entry) => entry.kind === "function")
        .map((entry) => entry.symbol),
    ).toEqual([
      "Store.constructor",
      "Store.load",
      "Store.get:value",
      "Store.set:value",
      "Store.change",
      "Store.save",
      "tools.run",
      "tools.arrow",
      "assigned",
    ]);
  });

  it("does not grant ownership to helpers returned by directly linked getters", () => {
    const result = audit(
      `
        function hidden() { return 1; }
        export class Store { get callback() { return hidden; } }
      `,
      `app.Store["callback"]`,
    );
    expect(result.errors).toEqual([
      "Missing architecture link: src/app.ts#hidden",
    ]);
  });

  it("resolves source-local type-only links for non-exported helpers", () => {
    const source = `
      import type { Implementation } from "../specs/definition/process.js";
      import type { stockDomain } from "../specs/artifacts/architecture/001-stock-domain.abb.js";
      function hidden() { return [1].map(value => value + 1); }
      export type PrivateLinks = Implementation<typeof stockDomain, [typeof hidden]>;
    `;
    const result = audit(source, "typeof app");
    expect(result.errors).toEqual([]);
    expect(result.inventory[1].symbol).toBe("hidden");
    expect(result.inventory[2].inheritedFrom).toBe("src/app.ts#hidden");
  });

  it.each([
    [
      "individual slots",
      'app.local["first"], app.local["second"], app.local["assigned"], app.local["store"]',
    ],
    ["whole maps", "app.local"],
  ])(
    "resolves ABB-owned private %s without conflating identical signatures",
    (_form, targets) => {
      const source = `
      import type { Bindings } from "../specs/definition/process.js";
      import type { PrivateSlots } from "../specs/links.js";
      function first() { return [1].map(value => value + 1); }
      function second() { return [1].map(value => value + 1); }
      const assigned = () => 1;
      class Store { constructor() {} }
      export type local = Bindings<PrivateSlots, {
        first: typeof first;
        second: typeof second;
        assigned: typeof assigned;
        store: typeof Store;
      }>;
    `;
      const links = `${declarations}
      export type PrivateSlots = {
        first: object; second: object; assigned: object; store: object;
      };
      export type Ownership = Links<typeof domain, [
        typeof app, ${targets}
      ]>;
    `;
      const result = auditSources(
        new Map([["src/app.ts", source]]),
        project,
        new Map([["specs/links.ts", links]]),
      );
      expect(result.errors).toEqual([]);
      expect(
        result.inventory
          .filter((entry) => entry.kind === "function")
          .map((entry) => entry.symbol),
      ).toEqual(["first", "second", "assigned", "Store.constructor"]);
      for (const entry of result.inventory) {
        expect(entry.architectureBlocks).toEqual([stockDomain.id]);
        expect(entry.requirements).toEqual([inventory.id]);
      }
      expect(
        result.inventory
          .filter((entry) => entry.kind === "callback")
          .map((entry) => entry.inheritedFrom),
      ).toEqual(["src/app.ts#first", "src/app.ts#second"]);
      const duplicate = auditSources(
        new Map([["src/app.ts", source]]),
        project,
        new Map([
          [
            "specs/links.ts",
            `${links}
        type Duplicate = Links<typeof domain, [app.local, app.local["first"]]>;
      `,
          ],
        ]),
      );
      expect(duplicate.errors).toContain(
        "Duplicate implementation target: src/app.ts#first",
      );
    },
  );

  it.each([
    ["empty maps", "{}", "Invalid implementation group"],
    [
      "open-ended maps",
      "Record<string, () => void>",
      "Invalid implementation group",
    ],
    [
      "unresolved members",
      "{ hidden: typeof hidden; invalid: string }",
      "Unresolved implementation target",
    ],
    [
      "nested maps",
      "{ nested: { hidden: typeof hidden } }",
      "Unresolved implementation target",
    ],
    ["class instances", "Store", "Invalid implementation group"],
  ])("rejects private groups with %s", (_form, binding, message) => {
    const result = audit(
      `
        function hidden() { return 1; }
        class Store { run() {} }
        export type local = ${binding};
      `,
      "app.local",
    );
    expect(result.errors.join()).toContain(message);
    expect(result.errors).toContain(
      "Missing architecture link: src/app.ts#Store.run",
    );
    if (binding !== "{ hidden: typeof hidden; invalid: string }") {
      expect(result.errors).toContain(
        "Missing architecture link: src/app.ts#hidden",
      );
    }
  });

  it("resolves interface contracts and checked bindings under their ABB owner", () => {
    const source = `
      import type { Bindings } from "../specs/definition/process.js";
      import type { Ownership } from "../specs/links.js";
      export function first() { return [1].map(value => value + 1); }
      function second() { return [1].map(value => value + 1); }
      export type local = Bindings<Ownership["contract"], {
        first: typeof first; second: typeof second;
      }>;
    `;
    const links = `${declarations}
      import type { Bindings as Checked } from "./definition/process.js";
      export interface Ownership extends Links<typeof domain, [typeof app]> {
        readonly contract: { first: object; second: object };
        readonly bindings: Checked<Ownership["contract"], app.local>;
      }
    `;
    const result = auditSources(
      new Map([["src/app.ts", source]]),
      project,
      new Map([["specs/links.ts", links]]),
    );
    expect(result.errors).toEqual([]);
    for (const entry of result.inventory) {
      expect(entry.architectureBlocks).toEqual([stockDomain.id]);
      expect(entry.requirements).toEqual([inventory.id]);
    }
    const duplicate = auditSources(
      new Map([["src/app.ts", source]]),
      project,
      new Map([
        [
          "specs/links.ts",
          links.replace("[typeof app]", "[typeof app, typeof app.first]"),
        ],
      ]),
    );
    expect(duplicate.errors).toContain(
      "Duplicate implementation target: src/app.ts#first",
    );
    const unchecked = auditSources(
      new Map([["src/app.ts", source]]),
      project,
      new Map([
        [
          "specs/links.ts",
          links.replace(
            'Checked<Ownership["contract"], app.local>',
            "app.local",
          ),
        ],
      ]),
    );
    expect(unchecked.errors.join()).toContain(
      "Interface bindings must use Bindings",
    );
    expect(unchecked.errors).toContain(
      "Missing architecture link: src/app.ts#first",
    );
  });

  it("rejects unresolved and duplicate symbol links", () => {
    expect(
      audit("export function reserve() {}", "typeof app.missing").errors.join(),
    ).toContain("Unresolved implementation target");
    expect(
      audit(
        "export function reserve() {}",
        "typeof app.reserve, typeof app.reserve",
      ).errors,
    ).toContain("Duplicate implementation target: src/app.ts#reserve");
  });

  it("rejects owners absent from the project and owners without requirements", () => {
    const result = auditSources(
      new Map([["src/app.ts", "export function reserve() {}"]]),
      { ...project, relations: [] },
      new Map([
        [
          "specs/links.ts",
          `${declarations}
        type Linked = Links<typeof domain, [typeof app, typeof app.reserve]>;
      `,
        ],
      ]),
    );
    expect(result.errors).toContain(
      "Architecture block has no implementation requirements: ABB-001",
    );
    expect(
      audit(
        "export function reserve() {}",
        "typeof app.reserve",
        "typeof missing",
      ).errors.join(),
    ).toContain("Unknown implementation owner");
  });

  it("inherits top-level callbacks from the module and skips declaration-only functions", () => {
    const result = audit(
      "setTimeout(() => {}, 1); declare function signature(): void; export {};",
      "typeof app",
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(2);
    expect(result.inventory[1].inheritedFrom).toBe("src/app.ts#<module>");
  });

  it("fails closed on dynamic names, undeclared assignments, and duplicate callables", () => {
    expect(
      audit(
        "const key = 'x'; export class Store { [key]() {} }",
        "typeof app",
      ).errors.join(),
    ).toContain("dynamic");
    expect(
      audit(
        "let assigned; assigned = () => 1; export {};",
        "typeof app",
      ).errors.join(),
    ).toContain("declared variable");
    expect(
      audit(
        "export function same() {} export function same() {}",
        "typeof app.same",
      ).errors.join(),
    ).toContain("Duplicate code target");
  });

  it("owns non-symbol assets through ABB file entries, without comment parsing", () => {
    const assetProject = {
      ...project,
      artifacts: [
        { ...stockDomain, files: ["src/app.css", "src/env.d.ts"] as const },
        browserStorage,
        inventory,
        orderLifecycle,
      ],
    };
    const result = auditSources(
      new Map([
        ["src/app.css", 'a { content: "no annotations"; }'],
        ["src/env.d.ts", 'declare module "cdn" {}'],
      ]),
      assetProject,
      new Map(),
    );
    expect(result.errors).toEqual([]);
    expect(
      result.inventory.every(
        (entry) => entry.architectureBlocks[0] === stockDomain.id,
      ),
    ).toBe(true);
  });

  it("rejects missing assets, unsupported sources, and empty inventories", () => {
    const assetProject = {
      ...project,
      artifacts: [
        { ...stockDomain, files: ["src/missing.css"] as const },
        browserStorage,
        inventory,
        orderLifecycle,
      ],
    };
    expect(auditSources(new Map(), assetProject, new Map()).errors).toContain(
      "Missing architecture file: ABB-001:src/missing.css",
    );
    expect(auditSources(new Map(), project, new Map()).errors).toContain(
      "No app source files found.",
    );
    expect(
      auditSources(new Map([["src/app.txt", "text"]]), project, new Map())
        .errors,
    ).toContain("Unsupported app source file: src/app.txt");
  });
});
