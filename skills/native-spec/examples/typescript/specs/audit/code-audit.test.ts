import { describe, expect, it } from "vitest";
import {
  browserStorage,
  inventory,
  orderLifecycle,
  stockDomain,
} from "../artifacts/index.js";
import {
  implementsRequirement,
  type SpecProject,
} from "../definition/process.js";
import { auditSources } from "./code-audit.js";

const architecture = { ...stockDomain, files: undefined };
const storage = { ...browserStorage, files: undefined };
const project: SpecProject = {
  id: inventory.project,
  title: "Annotation fixtures",
  artifacts: [architecture, storage, inventory, orderLifecycle],
  relations: [
    implementsRequirement(architecture, inventory),
    implementsRequirement(storage, orderLifecycle),
  ],
};

function audit(source: string) {
  return auditSources(
    new Map([
      ["src/app.ts", `/** @specModule ABB-001 */\n${source.trimStart()}`],
    ]),
    project,
  );
}

describe("exhaustive code traceability", () => {
  it("resolves requirements through the annotated architecture block", () => {
    const architecture = { ...stockDomain, files: ["src/app.ts"] as const };
    const project = {
      id: inventory.project,
      title: "Architecture traceability",
      artifacts: [architecture, inventory, orderLifecycle],
      relations: [
        implementsRequirement(architecture, inventory),
        implementsRequirement(architecture, orderLifecycle),
      ],
    };
    const result = auditSources(
      new Map([
        [
          "src/app.ts",
          `
      /** @specModule ABB-001 */
      /** @spec ABB-001 */
      export function reserve() { return [1].map(value => value + 1); }
    `,
        ],
      ]),
      project,
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(3);
    for (const entry of result.inventory) {
      expect(entry.architectureBlocks).toEqual([architecture.id]);
      expect(entry.requirements).toEqual([inventory.id, orderLifecycle.id]);
      expect(entry.directRequirements).toEqual([]);
    }
  });

  it("keeps direct requirement links optional and separate from ABB ownership", () => {
    const result = audit(`
      /** @spec ABB-002 REQ-SR-001 */
      function reserve() { return [1].map(value => value + 1); }
    `);
    expect(result.errors).toEqual([]);
    expect(result.inventory[1]?.architectureBlocks).toEqual([storage.id]);
    expect(result.inventory[1]?.directRequirements).toEqual([inventory.id]);
    expect(result.inventory[1]?.requirements).toEqual([
      orderLifecycle.id,
      inventory.id,
    ]);
    expect(result.inventory[2]?.directRequirements).toEqual([inventory.id]);
    expect(result.inventory[2]?.inheritedFrom).toBe("src/app.ts#reserve");
    expect(
      audit("/** @spec REQ-SR-001 */ function unowned() {}").errors,
    ).toContain("Missing architecture link: src/app.ts#unowned");
  });

  it("deduplicates requirements shared by several annotated ABBs", () => {
    const result = auditSources(
      new Map([
        [
          "src/app.ts",
          `
      /** @specModule ABB-001 ABB-002 */
      /** @spec ABB-001 ABB-002 REQ-SR-001 */
      function shared() {}
    `,
        ],
      ]),
      {
        ...project,
        relations: [
          ...project.relations,
          implementsRequirement(storage, inventory),
        ],
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory[1]?.architectureBlocks).toEqual([
      architecture.id,
      storage.id,
    ]);
    expect(result.inventory[1]?.requirements).toEqual([
      inventory.id,
      orderLifecycle.id,
    ]);
  });

  it("rejects ABBs without implemented requirements and dangling implementation relations", () => {
    const files = new Map([["src/app.ts", "/** @specModule ABB-001 */"]]);
    expect(auditSources(files, { ...project, relations: [] }).errors).toContain(
      "Architecture block has no implementation requirements: ABB-001",
    );
    expect(
      auditSources(files, {
        ...project,
        artifacts: [architecture, storage, inventory],
      }).errors,
    ).toContain("Invalid implementation relation: ABB-002 -> REQ-SR-002");
  });

  it("cross-checks ABB file declarations against source-owned module links", () => {
    const declared = { ...architecture, files: ["src/app.ts"] as const };
    const declaredProject = {
      ...project,
      artifacts: [declared, storage, inventory, orderLifecycle],
    };
    expect(
      auditSources(
        new Map([["src/app.ts", "/** @specModule ABB-001 */"]]),
        declaredProject,
      ).errors,
    ).toEqual([]);
    expect(
      auditSources(
        new Map([["src/app.ts", "/** @specModule ABB-002 */"]]),
        declaredProject,
      ).errors,
    ).toContain("Architecture file ownership mismatch: ABB-001:src/app.ts");
    const missingFileProject = {
      ...project,
      artifacts: [
        { ...architecture, files: ["src/missing.ts"] as const },
        storage,
        inventory,
        orderLifecycle,
      ],
    };
    const errors = auditSources(
      new Map([["src/app.ts", "/** @specModule ABB-001 */"]]),
      missingFileProject,
    ).errors;
    expect(errors).toContain(
      "Architecture block ABB-001 does not list annotated file: src/app.ts",
    );
    expect(errors).toContain(
      "Missing architecture file: ABB-001:src/missing.ts",
    );
  });

  it("does not require tooling-only ABB files inside the application audit boundary", () => {
    const tooling = {
      ...architecture,
      id: "ABB-099" as const,
      files: ["specs/audit/code-audit.ts"] as const,
    };
    expect(
      auditSources(new Map([["src/app.ts", "/** @specModule ABB-001 */"]]), {
        ...project,
        artifacts: [...project.artifacts, tooling],
      }).errors,
    ).toEqual([]);
  });

  it("rejects callable ownership that contradicts its ABB file list", () => {
    const result = auditSources(
      new Map([
        [
          "src/app.ts",
          `
        /** @specModule ABB-001 */
        /** @spec ABB-002 */
        function misplaced() {}
      `,
        ],
        ["src/storage.ts", "/** @specModule ABB-002 */"],
      ]),
      {
        ...project,
        artifacts: [
          { ...architecture, files: ["src/app.ts"] as const },
          { ...storage, files: ["src/storage.ts"] as const },
          inventory,
          orderLifecycle,
        ],
      },
    );
    expect(result.errors).toContain(
      "Architecture block ABB-002 does not list annotated file: src/app.ts",
    );
  });

  it("reads module and callable annotations directly from source", () => {
    const result = auditSources(
      new Map([
        [
          "src/app.ts",
          `
      /** @specModule ABB-001 */
      /** @spec ABB-002 */
      export function reserve() {
        return [1].map(value => value + 1);
      }
    `,
        ],
      ]),
      project,
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory[0]?.requirements).toEqual([inventory.id]);
    expect(result.inventory[1]?.requirements).toEqual([orderLifecycle.id]);
    expect(result.inventory[2]?.requirements).toEqual([orderLifecycle.id]);
    expect(result.inventory[2]?.inheritedFrom).toBe("src/app.ts#reserve");
  });

  it("finds unannotated named functions independently of annotations", () => {
    expect(audit("export function forgotten() {}").errors).toContain(
      "Missing architecture link: src/app.ts#forgotten",
    );
  });

  it("requires nested names to have their own links, but inherits inline callbacks", () => {
    const result = audit(`
      /** @spec ABB-001 */
      function outer() {
        /** @spec ABB-002 */
        const inner = () => [1].map(value => value + 1);
        return inner();
      }`);
    expect(result.errors).toEqual([]);
    const callback = result.inventory.find(
      (entry) => entry.kind === "callback",
    );
    expect(callback?.requirements).toEqual([orderLifecycle.id]);
    expect(callback?.inheritedFrom).toBe("src/app.ts#outer.inner");
    expect(callback?.line).toBe(5);
    expect(
      audit("/** @spec ABB-001 */ function outer() { function inner() {} }")
        .errors,
    ).toContain("Missing architecture link: src/app.ts#outer.inner");
  });

  it("enumerates constructors, accessors, methods, private and arrow properties", () => {
    const source = `class Store {
      /** @spec ABB-001 */
      constructor() {}
      /** @spec ABB-001 */
      get value() { return 1; }
      /** @spec ABB-001 */
      set value(v: number) {}
      /** @spec ABB-001 */
      static save() {}
      /** @spec ABB-001 */
      #read() {}
      /** @spec ABB-001 */
      change = () => 1;
    }
    const tools = {
      /** @spec ABB-001 */
      run() {},
      /** @spec ABB-001 */
      arrow: () => 1,
    };
    /** @spec ABB-001 */
    const assigned = (function named() {});
    `;
    const symbols = [
      "Store.constructor",
      "Store.get:value",
      "Store.set:value",
      "Store.save",
      "Store.#read",
      "Store.change",
      "tools.run",
      "tools.arrow",
      "assigned",
    ];
    const result = audit(source);
    expect(result.errors).toEqual([]);
    expect(
      result.inventory
        .filter((entry) => entry.kind === "function")
        .map((entry) => entry.symbol),
    ).toEqual(symbols);
  });

  it("rejects missing module annotations, orphan annotations and unknown requirements", () => {
    const result = auditSources(
      new Map([
        [
          "src/new.ts",
          `
      /** @specModule ABB-999 */
      /** @spec ABB-001 */
      const value = 1;
    `,
        ],
      ]),
      project,
    );
    expect(result.errors.join()).toContain("Unattached @spec annotation");
    expect(result.errors).toContain(
      "Unknown or unsupported spec target ABB-999 linked from src/new.ts#<module>",
    );
    expect(
      auditSources(new Map([["src/new.css", "body {}"]]), project).errors,
    ).toContain("Missing architecture link: src/new.css#<module>");
  });

  it("inventories top-level inline callbacks and declarations", () => {
    const result = audit(
      "setTimeout(() => {}, 1); declare function signature(): void;",
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(2);
    expect(result.inventory[1]?.inheritedFrom).toBe("src/app.ts#<module>");
  });

  it("does not mistake destructuring assignments for unregistered callables", () => {
    expect(audit("let value; ({value} = {value: 1});").errors).toEqual([]);
  });

  it("fails closed on dynamic names, assignments, duplicates and empty scope", () => {
    expect(
      audit("const key = 'x'; class A { [key]() {} }").errors.join(),
    ).toContain("dynamic");
    expect(audit("let x; x = () => 1;").errors.join()).toContain(
      "declared variable",
    );
    expect(
      audit(
        "/** @spec ABB-001 */ function same() {} /** @spec ABB-001 */ function same() {}",
      ).errors.join(),
    ).toContain("Duplicate code target");
    expect(audit("/** @specModule ABB-001 */").errors.join()).toContain(
      "Duplicate spec",
    );
    expect(auditSources(new Map(), project).errors).toContain(
      "No app source files found.",
    );
  });

  it("does not treat module coverage as coverage of the first named function", () => {
    expect(audit("function first() {}").errors).toEqual([
      "Missing architecture link: src/app.ts#first",
    ]);
  });

  it("accepts multiple IDs and repeated tags on one declaration", () => {
    const result = audit(`
      /**
       * Reserve stock.
       * @spec ABB-001
       * @spec ABB-002
       */
      function reserve() {}
    `);
    expect(result.errors).toEqual([]);
    expect(result.inventory[1]?.requirements).toEqual([
      inventory.id,
      orderLifecycle.id,
    ]);
    expect(
      audit("/** @spec ABB-001, ABB-002 */ function both() {}").errors,
    ).toEqual([]);
  });

  it("ignores annotation-like text in strings, templates and regular expressions", () => {
    const source = [
      'const text = "/** @spec ABB-999 */";',
      "const template = `/** @specModule ABB-999 */`;",
      "const pattern = /[/*] @spec ABB-999/;",
      "function missing() {}",
    ].join("\n");
    expect(audit(source).errors).toEqual([
      "Missing architecture link: src/app.ts#missing",
    ]);
  });

  it("ignores annotation-like JSX text while reading JSX expression comments", () => {
    const result = auditSources(
      new Map([
        [
          "src/app.tsx",
          `
      /** @specModule ABB-001 */
      const view = <div>/** @specModule ABB-999 */</div>;
      /** @spec ABB-002 */
      const render = () => <div>{/* normal comment */}</div>;
    `,
        ],
      ]),
      project,
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory[1]?.requirements).toEqual([orderLifecycle.id]);
  });

  it("finds trailing orphan annotations and rejects empty and misplaced tags", () => {
    expect(
      audit("const value = 1;\n/** @spec ABB-001 */").errors.join(),
    ).toContain("Unattached @spec annotation");
    expect(audit("/** @spec */ function empty() {}").errors.join()).toContain(
      "Empty @spec annotation",
    );
    expect(
      audit("const value = 1;\n/** @specModule ABB-002 */").errors.join(),
    ).toContain("must be in file header");
    expect(
      audit(
        "/** @spec ABB-001 ABB-001 */ function duplicate() {}",
      ).errors.join(),
    ).toContain("Duplicate spec link");
  });

  it("rejects one annotation shared ambiguously by multiple callable declarations", () => {
    expect(
      audit(
        "/** @spec ABB-001 */ const first = () => 1, second = () => 2;",
      ).errors.join(),
    ).toContain("Annotation applies to multiple code targets");
  });

  it("reads CSS header comments without treating CSS strings as annotations", () => {
    const result = auditSources(
      new Map([
        [
          "src/app.css",
          `
      /* @specModule ABB-001 ABB-002 */
      a { content: "/* @specModule ABB-999 */"; }
    `,
        ],
      ]),
      project,
    );
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0]?.requirements).toEqual([
      inventory.id,
      orderLifecycle.id,
    ]);
    expect(
      auditSources(
        new Map([
          ["src/app.css", 'a { content: "/* @specModule ABB-001 */"; }'],
        ]),
        project,
      ).errors,
    ).toContain("Missing architecture link: src/app.css#<module>");
  });

  it("rejects CSS declaration annotations, invalid CSS and unsupported source languages", () => {
    expect(
      auditSources(
        new Map([
          [
            "src/app.css",
            "/* @specModule ABB-001 */\n/* @spec ABB-001 */\na {}",
          ],
        ]),
        project,
      ).errors.join(),
    ).toContain("Unattached @spec annotation");
    expect(
      auditSources(new Map([["src/app.css", "a {"]]), project).errors.join(),
    ).toContain("Invalid CSS source");
    expect(
      auditSources(
        new Map([["src/app.txt", "/** @specModule ABB-001 */"]]),
        project,
      ).errors,
    ).toContain("Unsupported app source file: src/app.txt");
  });
});
