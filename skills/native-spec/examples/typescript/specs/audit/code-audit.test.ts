import { resolve } from "node:path";
import ts from "typescript";
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
import { auditSources, readAppSources } from "./code-audit.js";

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

describe("native requirement test links", () => {
  function verification(
    source: string,
    criteria = inventory.acceptanceCriteria
      .map(
        (criterion) =>
          `{ id: ${JSON.stringify(criterion.id)}, description: "Checked", tests: testedBy<[tests.specBindings["check"]]>() }`,
      )
      .join(","),
  ) {
    return auditSources(
      new Map([["src/app.ts", "export const value = 1;"]]),
      project,
      new Map([
        ["tests/linked.test.ts", source],
        [
          "specs/links.ts",
          `${declarations}
          import { testedBy } from "./definition/process.js";
          import type * as tests from "../tests/linked.test.js";
          import { inventory } from "./artifacts/requirements/001-inventory.sr.js";
          type Ownership = Links<typeof domain, [typeof app]>;
          export const linkedRequirement = {
            ...inventory,
            acceptanceCriteria: [${criteria}],
          } as const;
        `,
        ],
      ]),
    );
  }

  const testSource = `
    import { it as test } from "vitest";
    function check(value: number) {}
    export type specBindings = { check: typeof check };
    test.each([1, 2])("checks %s", check);
  `;

  it("resolves private parameterized tests without adding tests to app ownership", () => {
    const result = verification(testSource);
    expect(result.errors).toEqual([]);
    expect(result.inventory).toHaveLength(1);
    expect(result.tests).toEqual([
      expect.objectContaining({
        file: "tests/linked.test.ts",
        symbol: "check",
        line: 3,
        verifications: ["search", "availability", "restock", "overview"].map(
          (criterion) => ({ requirement: inventory.id, criterion }),
        ),
      }),
    ]);
  });

  it("accepts direct test calls and namespace imports", () => {
    expect(
      verification(
        testSource.replace(
          'test.each([1, 2])("checks %s", check)',
          'test("checks", check)',
        ),
      ).errors,
    ).toEqual([]);
    expect(
      verification(
        testSource
          .replace("import { it as test }", "import * as suite")
          .replace("test.each", "suite.test.each"),
      ).errors,
    ).toEqual([]);
  });

  it("rejects helpers, fake registrations, and skipped tests", () => {
    for (const source of [
      testSource.replace('test.each([1, 2])("checks %s", check);', ""),
      testSource
        .replace(
          'import { it as test } from "vitest";',
          "function test(...args: unknown[]) {}",
        )
        .replace("test.each([1, 2])", "test"),
      testSource.replace("test.each", "test.skip.each"),
    ]) {
      const result = verification(source);
      expect(result.errors).toContain(
        `Verification target is not a registered Vitest test or nonempty suite: ${inventory.id}:search`,
      );
      expect(result.tests).toEqual([]);
    }
  });

  const suiteSource = `
    import { describe as suite, it } from "vitest";
    function checks() { it("checks stock", () => {}); }
    export type specBindings = { check: typeof checks };
    suite("stock suite", checks);
  `;

  it("links real suite callbacks, including aliases, namespaces, parameterization, and nested suites", () => {
    for (const source of [
      suiteSource,
      suiteSource.replace(
        'suite("stock suite", checks)',
        'suite.each([1, 2])("stock suite %s", checks)',
      ),
      suiteSource
        .replace(
          'import { describe as suite, it } from "vitest";',
          'import * as suite from "vitest";',
        )
        .replace('it("checks stock"', 'suite.it("checks stock"')
        .replace('suite("stock suite"', 'suite.describe("stock suite"'),
      suiteSource.replace(
        'function checks() { it("checks stock", () => {}); }',
        'function inner() { it("checks stock", () => {}); } function checks() { suite("nested", inner); }',
      ),
    ]) {
      const result = verification(source);
      expect(result.errors).toEqual([]);
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]).toMatchObject({
        kind: "suite",
        symbol: "checks",
      });
    }
  });

  it("rejects empty or skipped suites and suites with no executable children", () => {
    for (const source of [
      suiteSource.replace('it("checks stock", () => {});', ""),
      suiteSource.replace('it("checks stock"', 'it.skip("checks stock"'),
      suiteSource.replace('suite("stock suite"', 'suite.skip("stock suite"'),
      suiteSource.replace(
        'it("checks stock", () => {});',
        'suite("nested", () => { it.skip("later", () => {}); });',
      ),
    ]) {
      const result = verification(source);
      expect(result.errors).toContain(
        `Verification target is not a registered Vitest test or nonempty suite: ${inventory.id}:search`,
      );
      expect(result.tests).toEqual([]);
    }
  });

  it("does not accept a leaf test inside a skipped suite", () => {
    const result = verification(
      testSource
        .replace(
          'test.each([1, 2])("checks %s", check);',
          'suite.skip("disabled", () => { test("checks", check); });',
        )
        .replace(
          "import { it as test }",
          "import { it as test, describe as suite }",
        ),
    );
    expect(result.tests).toEqual([]);
    expect(result.errors.join()).toContain(
      "not a registered Vitest test or nonempty suite",
    );
  });

  it("reports missing, unknown, empty, and duplicate criterion links", () => {
    const result = verification(
      testSource,
      `
      { id: "search", description: "Search", tests: testedBy<[tests.specBindings["check"], tests.specBindings["check"]]>() },
      { id: "availability", description: "Availability", tests: testedBy<[]>() },
      { id: "overview", description: "Overview" },
      { id: "typo", description: "Unknown", tests: testedBy<[tests.specBindings["check"]]>() },
    `,
    );
    expect(result.errors).toContain(
      `Missing acceptance criterion test link: ${inventory.id}:restock`,
    );
    expect(result.errors).toContain(
      `Missing acceptance criterion test link: ${inventory.id}:overview`,
    );
    expect(result.errors).toContain(
      `Unknown verification criterion: ${inventory.id}:typo`,
    );
    expect(result.errors).toContain(
      `Verification requires a nonempty test tuple: ${inventory.id}:availability`,
    );
    expect(result.errors).toContain(
      `Duplicate verification target: ${inventory.id}:search`,
    );
  });

  it("rejects criterion fields without the canonical test-reference marker", () => {
    const source = testSource.replace(
      'test.each([1, 2])("checks %s", check);',
      "",
    );
    const result = verification(
      source,
      '{ id: "search", description: "Search", tests: {} }',
    );
    expect(result.tests).toEqual([]);
    expect(result.errors).toContain(
      `Criterion test links must use testedBy: ${inventory.id}:search`,
    );
  });

  it("rejects a requirement with no executable test links at all", () => {
    const result = verification(
      testSource,
      inventory.acceptanceCriteria
        .map(
          (criterion) =>
            `{ id: ${JSON.stringify(criterion.id)}, description: "Unlinked" }`,
        )
        .join(","),
    );
    for (const criterion of inventory.acceptanceCriteria)
      expect(result.errors).toContain(
        `Missing acceptance criterion test link: ${inventory.id}:${criterion.id}`,
      );
    expect(result.tests).toEqual([]);
  });
});

describe("native implementation links", () => {
  it("preserves native navigation to exported, private, constructor, and method declarations", () => {
    const root = resolve(import.meta.dirname, "../..");
    const configFile = resolve(root, "specs/tsconfig.json");
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      resolve(root, "specs"),
      undefined,
      configFile,
    );
    expect(config.error).toBeUndefined();
    expect(parsed.errors).toEqual([]);
    const service = ts.createLanguageService({
      ...ts.sys,
      getScriptFileNames: () => parsed.fileNames,
      getScriptVersion: () => "0",
      getScriptSnapshot: (file) => {
        const text = ts.sys.readFile(file);
        return text === undefined
          ? undefined
          : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => root,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      getCompilationSettings: () => parsed.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    });
    try {
      const program = service.getProgram()!;
      const cases = [
        ["domain.ts", "seedWorkspace", ts.ScriptElementKind.functionElement],
        ["domain.ts", "record", ts.ScriptElementKind.functionElement],
        ["storage.ts", "importWorkspace", ts.ScriptElementKind.functionElement],
        ["storage.ts", "WorkspaceStore", ts.ScriptElementKind.classElement],
        ["storage.ts", "load", ts.ScriptElementKind.memberFunctionElement],
        ["main.ts", "perform", ts.ScriptElementKind.functionElement],
      ] as const;
      for (const [implementation, name, kind] of cases) {
        const file = resolve(root, "src", implementation);
        const source = program.getSourceFile(file)!;
        const slot = source.statements
          .filter(ts.isInterfaceDeclaration)
          .filter((declaration) => declaration.name.text === "specBindings")
          .flatMap((declaration) => [...declaration.members])
          .filter(ts.isPropertySignature)
          .find(
            (member) =>
              ts.isIdentifier(member.name) && member.name.text === name,
          )!;
        expect(slot).toBeDefined();
        const expected = { fileName: file, name, kind };
        const destinations =
          service.getTypeDefinitionAtPosition(
            file,
            slot.name.getStart(source),
          ) ?? [];
        expect(
          destinations.map(({ fileName, name, kind }) => ({
            fileName,
            name,
            kind,
          })),
        ).toContainEqual(expected);
      }
      for (const [artifact, module] of [
        ["001-stock-domain.abb.ts", "domain.ts"],
        ["002-browser-storage.abb.ts", "storage.ts"],
        ["003-inventory-desk.abb.ts", "main.ts"],
      ] as const) {
        const file = resolve(root, "specs/artifacts/architecture", artifact);
        const text = program.getSourceFile(file)!.text;
        const position = text.indexOf(".specBindings]") + 1;
        expect(position).toBeGreaterThan(0);
        expect(
          service
            .getDefinitionAtPosition(file, position)
            ?.map(({ fileName, name }) => ({ fileName, name })),
        ).toContainEqual({
          fileName: resolve(root, "src", module),
          name: "specBindings",
        });
      }
      const requirementFile = resolve(
        root,
        "specs/artifacts/requirements/001-inventory.sr.ts",
      );
      const requirement = program.getSourceFile(requirementFile)!;
      const position = requirement.text.indexOf('"seededInventory"') + 1;
      expect(position).toBeGreaterThan(0);
      expect(
        service
          .getTypeDefinitionAtPosition(requirementFile, position)
          ?.map(({ fileName, name, kind }) => ({ fileName, name, kind })),
      ).toContainEqual({
        fileName: resolve(root, "tests/domain.test.ts"),
        name: "seededInventory",
        kind: ts.ScriptElementKind.functionElement,
      });
    } finally {
      service.dispose();
    }
  });

  it(
    "resolves imported functions and derives requirements through ABB relations",
    requirementLinks,
  );

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

  it("resolves exported and private bindings through one callable contract", () => {
    const source = `
      import type { Bindings } from "../specs/definition/process.js";
      import type { Ownership } from "../specs/links.js";
      export function first() { return [1].map(value => value + 1); }
      function second() { return [1].map(value => value + 1); }
      export type specBindings = Bindings<Ownership["contract"], {
        first: typeof first; second: typeof second;
      }>;
    `;
    const links = `${declarations}
      import type { Bindings as Checked, Callable } from "./definition/process.js";
      export interface Ownership extends Links<typeof domain, [typeof app]> {
        readonly contract: { first: Callable; second: Callable };
        readonly specBindings: Checked<Ownership["contract"], app.specBindings>;
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
            'Checked<Ownership["contract"], app.specBindings>',
            "app.specBindings",
          ),
        ],
      ]),
    );
    expect(unchecked.errors.join()).toContain(
      "Interface specBindings must use Bindings",
    );
    expect(unchecked.errors).toContain(
      "Missing architecture link: src/app.ts#first",
    );
  });

  it("rejects unresolved and duplicate symbol links", invalidLinks);

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

  it(
    "inherits top-level callbacks from the module and skips declaration-only functions",
    callbackInheritance,
  );

  it(
    "enumerates source files, supporting assets, and implemented callables",
    enumerateCode,
  );
  it(
    "keeps tests, specs, dependencies, and output outside the app boundary",
    appBoundary,
  );
  it(
    "checks native compiler contracts and negative type assertions",
    compilerContracts,
    15_000,
  );

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

function requirementLinks() {
  const result = audit(
    "export function reserve() { return [1].map(value => value + 1); }",
    "typeof app.reserve",
  );
  expect(result.errors).toEqual([]);
  expect(result.inventory).toHaveLength(3);
  for (const entry of result.inventory) {
    expect(entry.architectureBlocks).toEqual([stockDomain.id]);
    expect(entry.requirements).toEqual([inventory.id]);
    expect(entry.line).toBeGreaterThan(0);
    expect(entry.column).toBeGreaterThan(0);
  }
  expect(result.inventory[2].inheritedFrom).toBe("src/app.ts#reserve");
}

function callbackInheritance() {
  const result = audit(
    "setTimeout(() => {}, 1); declare function signature(): void; export {};",
    "typeof app",
  );
  expect(result.errors).toEqual([]);
  expect(result.inventory).toHaveLength(2);
  expect(result.inventory[1].inheritedFrom).toBe("src/app.ts#<module>");
  const nested = audit(
    "export function reserve() { return [1].map(value => value + 1); }",
    "typeof app.reserve",
  );
  expect(nested.errors).toEqual([]);
  expect(nested.inventory[2].inheritedFrom).toBe("src/app.ts#reserve");
  expect(nested.inventory[2].requirements).toEqual([inventory.id]);
}

function invalidLinks() {
  expect(
    audit("export function reserve() {}", "typeof app.missing").errors.join(),
  ).toContain("Unresolved implementation target");
  expect(
    audit(
      "export function reserve() {}",
      "typeof app.reserve, typeof app.reserve",
    ).errors,
  ).toContain("Duplicate implementation target: src/app.ts#reserve");
  expect(audit("export function reserve() {}", "typeof app").errors).toContain(
    "Missing architecture link: src/app.ts#reserve",
  );
  expect(
    auditSources(new Map([["src/app.txt", "text"]]), project, new Map()).errors,
  ).toContain("Unsupported app source file: src/app.txt");
}

function enumerateCode() {
  const result = auditSources(
    new Map([
      ["src/app.ts", "export function reserve() {}"],
      ["src/app.css", "body {}"],
      ["src/env.d.ts", 'declare module "cdn" {}'],
    ]),
    {
      ...project,
      artifacts: [
        { ...stockDomain, files: ["src/app.css", "src/env.d.ts"] },
        browserStorage,
        inventory,
        orderLifecycle,
      ],
    },
    new Map([
      [
        "specs/links.ts",
        `${declarations} type Ownership = Links<typeof domain, [typeof app, typeof app.reserve]>;`,
      ],
    ]),
  );
  expect(result.errors).toEqual([]);
  expect(result.inventory.map(({ file, symbol }) => [file, symbol])).toEqual([
    ["src/app.ts", "<module>"],
    ["src/app.ts", "reserve"],
    ["src/app.css", "<module>"],
    ["src/env.d.ts", "<module>"],
  ]);
}

function appBoundary() {
  const sources = readAppSources(resolve(import.meta.dirname, "../.."));
  expect(sources.size).toBeGreaterThan(0);
  expect([...sources.keys()].every((file) => file.startsWith("src/"))).toBe(
    true,
  );
  for (const file of [
    "tests/domain.test.ts",
    "specs/audit/code-audit.ts",
    "vite.config.ts",
    "dist/index.html",
    "node_modules/vitest/package.json",
  ])
    expect(sources.has(file)).toBe(false);
}

function compilerContracts() {
  const configFile = resolve(import.meta.dirname, "../tsconfig.json");
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    resolve(import.meta.dirname, ".."),
    undefined,
    configFile,
  );
  expect(parsed.errors).toEqual([]);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  expect(
    program
      .getSourceFiles()
      .some((source) => source.fileName.endsWith("process.type-test.ts")),
  ).toBe(true);
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
  ).toEqual([]);
}
