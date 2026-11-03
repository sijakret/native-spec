export type OneOrMore<Value> = readonly [Value, ...Value[]];

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Three = `${Digit}${Digit}${Digit}`;

export type MarketRequirementId = `REQ-MR-${Three}`;
export type SoftwareRequirementId = `REQ-SR-${Three}`;
export type NonFunctionalRequirementId = `REQ-NFR-${Three}`;
export type ArchitectureBlockId = `ABB-${Three}`;
export type TestCaseId = `TC-${Three}`;
export type RiskId = `RISK-${Three}`;
export type SprintId = `SPRINT-${Digit}${Three}`;

export type ArtifactKind =
  | "market-requirement"
  | "software-requirement"
  | "non-functional-requirement"
  | "architecture-block"
  | "test-case"
  | "risk"
  | "sprint";

interface BaseArtifact<
  Project extends string,
  Kind extends ArtifactKind,
  Id extends string,
> {
  readonly project: Project;
  readonly kind: Kind;
  readonly id: Id;
  readonly title: string;
}

export interface AcceptanceCriterion {
  readonly id: string;
  readonly description: string;
}

interface RequirementFields<
  Criteria extends OneOrMore<AcceptanceCriterion> =
    OneOrMore<AcceptanceCriterion>,
> {
  readonly tags: OneOrMore<string>;
  readonly description: string;
  readonly acceptanceCriteria: Criteria;
}

export type MarketRequirement<
  Project extends string = string,
  Id extends MarketRequirementId = MarketRequirementId,
  Criteria extends OneOrMore<AcceptanceCriterion> =
    OneOrMore<AcceptanceCriterion>,
> = BaseArtifact<Project, "market-requirement", Id> &
  RequirementFields<Criteria>;

export type SoftwareRequirement<
  Project extends string = string,
  Id extends SoftwareRequirementId = SoftwareRequirementId,
  Criteria extends OneOrMore<AcceptanceCriterion> =
    OneOrMore<AcceptanceCriterion>,
> = BaseArtifact<Project, "software-requirement", Id> &
  RequirementFields<Criteria>;

export type NonFunctionalRequirement<
  Project extends string = string,
  Id extends NonFunctionalRequirementId = NonFunctionalRequirementId,
  Criteria extends OneOrMore<AcceptanceCriterion> =
    OneOrMore<AcceptanceCriterion>,
> = BaseArtifact<Project, "non-functional-requirement", Id> &
  RequirementFields<Criteria>;

export interface CodeBlock {
  readonly title: string;
  readonly language: string;
  readonly source: string;
}

// An Excalidraw scene stored next to its module as `<module>.figure-NNN.excalidraw.svg`
// (an SVG with the editable scene embedded). Create one with `figure()`.
export interface Figure {
  readonly title: string;
  // Absolute URL of the sidecar file.
  readonly excalidraw: string;
  // Inline tokens for text fields: `${figure.ref}` links to it, `${figure.image}` embeds it.
  readonly ref: string;
  readonly image: string;
}

export interface ArchitectureDiagram extends CodeBlock {
  readonly language: "mermaid";
  readonly blocks: OneOrMore<ArchitectureBlock>;
  readonly connections: readonly {
    readonly from: ArchitectureBlock;
    readonly to: ArchitectureBlock;
    readonly label: string;
    readonly dashed?: boolean;
  }[];
}

export interface ArchitectureFigure extends Figure {
  readonly blocks: OneOrMore<ArchitectureBlock>;
}

export type Diagram =
  | CodeBlock
  | Figure
  | ArchitectureDiagram
  | ArchitectureFigure;

export function architectureFigure(
  value: Figure,
  blocks: OneOrMore<ArchitectureBlock>,
): ArchitectureFigure {
  return Object.freeze({ ...value, blocks });
}

export function architectureDiagram(
  value: Pick<ArchitectureDiagram, "title" | "blocks" | "connections">,
): ArchitectureDiagram {
  return Object.freeze({
    ...value,
    language: "mermaid",
    source: architectureDiagramSource(value),
  });
}

function architectureDiagramSource(
  value: Pick<ArchitectureDiagram, "blocks" | "connections">,
): string {
  const node = (block: ArchitectureBlock) => block.id.replaceAll("-", "_");
  const label = (text: string) =>
    text
      .replaceAll("&", "#38;")
      .replaceAll('"', "#34;")
      .replaceAll("<", "#60;")
      .replaceAll(">", "#62;")
      .replace(/[\r\n]/g, " ");
  return [
    "flowchart LR",
    ...value.blocks.map(
      (block) => `  ${node(block)}["${label(`${block.id} - ${block.title}`)}"]`,
    ),
    ...value.connections.map(
      (connection) =>
        `  ${node(connection.from)} ${connection.dashed ? "-.->" : "-->"}|"${label(connection.label)}"| ${node(connection.to)}`,
    ),
  ].join("\n");
}

function isArchitectureDiagram(
  diagram: Diagram,
): diagram is ArchitectureDiagram | ArchitectureFigure {
  return "blocks" in diagram;
}

export const figureSuffix = ".excalidraw.svg";

// Markdown link/image syntax, restricted to `.excalidraw.svg` targets so plain text never matches.
export const figureToken =
  /(!?)\[((?:\\.|[^\\\]])*)\]\(<([^<>]+\.excalidraw\.svg)>\)/g;

// `figure(import.meta.url, 1, "Order states")` in `001-stock-domain.abb.ts`
// -> `001-stock-domain.abb.figure-001.excalidraw.svg` in the same folder.
export function figure(
  moduleUrl: string,
  number: number,
  title: string,
): Figure {
  if (!Number.isInteger(number) || number < 1 || number > 999)
    throw new Error(`Figure number must be 1-999: ${number}`);
  if (!title.trim()) throw new Error("Figure title is required.");
  const url = new URL(moduleUrl);
  const name = url.pathname
    .split("/")
    .pop()!
    .replace(/\.[cm]?[jt]s$/, "");
  const excalidraw = new URL(
    `${name}.figure-${String(number).padStart(3, "0")}${figureSuffix}`,
    url,
  ).href;
  const label = title.replace(/[\\[\]]/g, "\\$&");
  return Object.freeze({
    title,
    excalidraw,
    ref: `[${label}](<${excalidraw}>)`,
    image: `![${label}](<${excalidraw}>)`,
  });
}

export function isFigure(diagram: Diagram): diagram is Figure {
  return "excalidraw" in diagram;
}

export type TextPart =
  | string
  | {
      readonly embed: boolean;
      readonly title: string;
      readonly excalidraw: string;
    };

// Splits text into plain runs and `${figure.ref}` / `${figure.image}` tokens.
export function figureParts(text: string): readonly TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(figureToken)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({
      embed: match[1] === "!",
      title: match[2]!.replace(/\\(.)/g, "$1"),
      excalidraw: match[3]!,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export type ArchitectureBlock<
  Project extends string = string,
  Id extends ArchitectureBlockId = ArchitectureBlockId,
> = BaseArtifact<Project, "architecture-block", Id> & {
  readonly tags: OneOrMore<string>;
  readonly description: string;
  readonly responsibilities: OneOrMore<string>;
  readonly summaryDiagram:
    | Figure
    | (CodeBlock & { readonly language: "mermaid" });
  readonly files?: OneOrMore<string>;
  readonly diagrams?: OneOrMore<Diagram>;
};

export type Implementation<
  Owner extends ArchitectureBlock,
  Targets extends OneOrMore<object>,
> = {
  readonly owner: Owner;
  readonly targets: Targets;
};

export type TestCase<
  Project extends string = string,
  Id extends TestCaseId = TestCaseId,
> = BaseArtifact<Project, "test-case", Id> & {
  readonly type: "automated" | "visual";
  readonly code: OneOrMore<string>;
  readonly description: string;
  readonly steps: OneOrMore<string>;
  readonly expected: OneOrMore<string>;
};

export type RiskLevel = "critical" | "high" | "medium" | "low";

export type Risk<
  Project extends string = string,
  Id extends RiskId = RiskId,
> = BaseArtifact<Project, "risk", Id> & {
  readonly level: RiskLevel;
  readonly tags: OneOrMore<string>;
  readonly description: string;
  readonly mitigation: OneOrMore<string>;
  readonly impact: string;
};

export interface Task {
  readonly text: string;
  readonly done: boolean;
  readonly children?: readonly Task[];
}

export type SprintStatus = "planned" | "in-progress" | "completed" | "deferred";

export type Sprint<
  Project extends string = string,
  Id extends SprintId = SprintId,
> = BaseArtifact<Project, "sprint", Id> & {
  readonly status: SprintStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly description: string;
  readonly diagrams?: OneOrMore<Diagram>;
  readonly interfaces?: OneOrMore<string>;
  readonly dependenciesAndRisks?: OneOrMore<string>;
  readonly verification?: OneOrMore<string>;
  readonly tasks: OneOrMore<Task>;
  readonly implementation?: OneOrMore<string>;
  readonly architectureReview: OneOrMore<Task>;
  readonly documentationIntegrity: OneOrMore<Task>;
};

export type Requirement<Project extends string = string> =
  | MarketRequirement<Project>
  | SoftwareRequirement<Project>
  | NonFunctionalRequirement<Project>;

export type Deliverable<Project extends string = string> =
  | Requirement<Project>
  | ArchitectureBlock<Project>
  | TestCase<Project>
  | Risk<Project>;

export type Artifact<Project extends string = string> =
  | Deliverable<Project>
  | Sprint<Project>;

type ArtifactInput<Value extends Artifact> = Omit<Value, "project" | "kind">;

export function artifactFactory<const Project extends string>(
  project: Project,
) {
  const create = <Kind extends ArtifactKind, Value extends object>(
    kind: Kind,
    value: Value,
  ) => Object.freeze({ project, kind, ...value });

  return {
    marketRequirement<
      const Id extends MarketRequirementId,
      const Criteria extends OneOrMore<AcceptanceCriterion>,
    >(
      value: ArtifactInput<MarketRequirement<Project, Id, Criteria>>,
    ): MarketRequirement<Project, Id, Criteria> {
      return create("market-requirement", value);
    },
    softwareRequirement<
      const Id extends SoftwareRequirementId,
      const Criteria extends OneOrMore<AcceptanceCriterion>,
    >(
      value: ArtifactInput<SoftwareRequirement<Project, Id, Criteria>>,
    ): SoftwareRequirement<Project, Id, Criteria> {
      return create("software-requirement", value);
    },
    nonFunctionalRequirement<
      const Id extends NonFunctionalRequirementId,
      const Criteria extends OneOrMore<AcceptanceCriterion>,
    >(
      value: ArtifactInput<NonFunctionalRequirement<Project, Id, Criteria>>,
    ): NonFunctionalRequirement<Project, Id, Criteria> {
      return create("non-functional-requirement", value);
    },
    architectureBlock<const Id extends ArchitectureBlockId>(
      value: ArtifactInput<ArchitectureBlock<Project, Id>>,
    ): ArchitectureBlock<Project, Id> {
      return create("architecture-block", value);
    },
    testCase<const Id extends TestCaseId>(
      value: ArtifactInput<TestCase<Project, Id>>,
    ): TestCase<Project, Id> {
      return create("test-case", value);
    },
    risk<const Id extends RiskId>(
      value: ArtifactInput<Risk<Project, Id>>,
    ): Risk<Project, Id> {
      return create("risk", value);
    },
    sprint<const Id extends SprintId>(
      value: ArtifactInput<Sprint<Project, Id>>,
    ): Sprint<Project, Id> {
      return create("sprint", value);
    },
  };
}

export interface ArtifactRef<
  Project extends string = string,
  Kind extends ArtifactKind = ArtifactKind,
  Id extends string = string,
> {
  readonly project: Project;
  readonly kind: Kind;
  readonly id: Id;
}

type RefOf<Value extends Artifact> = ArtifactRef<
  Value["project"],
  Value["kind"],
  Value["id"]
>;

export interface DirectedRelation<
  Kind extends string = string,
  From extends ArtifactRef = ArtifactRef,
  To extends ArtifactRef = ArtifactRef,
> {
  readonly kind: Kind;
  readonly from: From;
  readonly to: To;
}

export type DerivesFrom = DirectedRelation<
  "derives-from",
  ArtifactRef<string, "software-requirement", SoftwareRequirementId>,
  ArtifactRef<string, "market-requirement", MarketRequirementId>
>;

export type Implements = DirectedRelation<
  "implements",
  ArtifactRef<string, "architecture-block", ArchitectureBlockId>,
  ArtifactRef<
    string,
    "software-requirement" | "non-functional-requirement",
    SoftwareRequirementId | NonFunctionalRequirementId
  >
>;

export type CriterionRef = ArtifactRef<
  string,
  Requirement["kind"],
  Requirement["id"]
> & { readonly criterion: string };

export type Verifies = DirectedRelation<
  "verifies",
  ArtifactRef<string, "test-case", TestCaseId>,
  CriterionRef | ArtifactRef<string, "risk", RiskId>
>;

export type Delivers = DirectedRelation<
  "delivers",
  ArtifactRef<string, "sprint", SprintId>,
  ArtifactRef<string, Deliverable["kind"], Deliverable["id"]>
>;

export type Threatens = DirectedRelation<
  "threatens",
  ArtifactRef<string, "risk", RiskId>,
  ArtifactRef<string, Requirement["kind"], Requirement["id"]>
>;

export type Relation =
  | DerivesFrom
  | Implements
  | Verifies
  | Delivers
  | Threatens;

function ref<const Value extends Artifact>(value: Value): RefOf<Value> {
  return { project: value.project, kind: value.kind, id: value.id };
}

function edge<
  const Kind extends Relation["kind"],
  const From extends Artifact,
  const To extends Artifact,
>(
  kind: Kind,
  from: From,
  to: To,
): DirectedRelation<Kind, RefOf<From>, RefOf<To>> {
  return Object.freeze({ kind, from: ref(from), to: ref(to) });
}

export function derivesFrom<
  const From extends SoftwareRequirement,
  const To extends MarketRequirement<From["project"]>,
>(from: From, to: To) {
  return edge("derives-from", from, to);
}

export function implementsRequirement<
  const From extends ArchitectureBlock,
  const To extends
    | SoftwareRequirement<From["project"]>
    | NonFunctionalRequirement<From["project"]>,
>(from: From, to: To) {
  return edge("implements", from, to);
}

export function verifies<
  const From extends TestCase,
  const To extends Requirement<From["project"]>,
  const Criterion extends To["acceptanceCriteria"][number]["id"],
>(
  from: From,
  to: To,
  criterion: Criterion,
): DirectedRelation<
  "verifies",
  RefOf<From>,
  RefOf<To> & { readonly criterion: Criterion }
>;
export function verifies<
  const From extends TestCase,
  const To extends Risk<From["project"]>,
>(from: From, to: To): DirectedRelation<"verifies", RefOf<From>, RefOf<To>>;
export function verifies(
  from: TestCase,
  to: Requirement | Risk,
  criterion?: string,
) {
  return to.kind === "risk"
    ? edge("verifies", from, to)
    : Object.freeze({
        kind: "verifies" as const,
        from: ref(from),
        to: { ...ref(to), criterion },
      });
}

export function delivers<
  const From extends Sprint,
  const To extends Deliverable<From["project"]>,
>(from: From, to: To) {
  return edge("delivers", from, to);
}

export function threatens<
  const From extends Risk,
  const To extends Requirement<From["project"]>,
>(from: From, to: To) {
  return edge("threatens", from, to);
}

type Item<Values extends readonly unknown[]> = Values[number];
type Identity = Pick<Artifact, "kind" | "id">;
type Key<Value extends Identity> = `${Value["kind"]}:${Value["id"]}`;
type ArtifactKeys<Artifacts extends readonly Artifact[]> = Key<Item<Artifacts>>;
type KeysOfKind<
  Artifacts extends readonly Artifact[],
  Kind extends ArtifactKind,
> =
  Item<Artifacts> extends infer Value
    ? Value extends Artifact & { readonly kind: Kind }
      ? Key<Value>
      : never
    : never;
type SourceKeys<
  Relations extends readonly Relation[],
  Kind extends Relation["kind"],
> =
  Item<Relations> extends infer Value
    ? Value extends {
        readonly kind: Kind;
        readonly from: infer From extends Identity;
      }
      ? Key<From>
      : never
    : never;
type TargetKeys<
  Relations extends readonly Relation[],
  Kind extends Relation["kind"],
> =
  Item<Relations> extends infer Value
    ? Value extends {
        readonly kind: Kind;
        readonly to: infer To extends Identity;
      }
      ? Key<To>
      : never
    : never;
type EndpointKeys<Relations extends readonly Relation[]> =
  Item<Relations> extends infer Value
    ? Value extends {
        readonly from: infer From extends Identity;
        readonly to: infer To extends Identity;
      }
      ? Key<From> | Key<To>
      : never
    : never;
type CriterionKeys<Artifacts extends readonly Artifact[]> =
  Item<Artifacts> extends infer Value
    ? Value extends Requirement
      ? `${Key<Value>}:${Value["acceptanceCriteria"][number]["id"]}`
      : never
    : never;
type VerifiedCriterionKeys<Relations extends readonly Relation[]> =
  Item<Relations> extends infer Value
    ? Value extends {
        readonly kind: "verifies";
        readonly to: infer To extends CriterionRef;
      }
      ? `${Key<To>}:${To["criterion"]}`
      : never
    : never;
type Missing<
  Expected extends string,
  Actual extends string,
  Label extends string,
> =
  Exclude<Expected, Actual> extends infer Value extends string
    ? `${Label}: ${Value}`
    : never;
type WrongProject<
  Project extends string,
  Artifacts extends readonly Artifact[],
> =
  Item<Artifacts> extends infer Value
    ? Value extends Artifact
      ? Value["project"] extends Project
        ? Project extends Value["project"]
          ? never
          : "Wrong project artifact"
        : "Wrong project artifact"
      : never
    : never;

// Every required link, as a compile-time diagnostic naming the offending artifact.
type StaticProblems<
  Project extends string,
  Artifacts extends readonly Artifact[],
  Relations extends readonly Relation[],
> =
  | WrongProject<Project, Artifacts>
  | Missing<
      EndpointKeys<Relations>,
      ArtifactKeys<Artifacts>,
      "Missing endpoint"
    >
  | Missing<
      KeysOfKind<Artifacts, "software-requirement">,
      SourceKeys<Relations, "derives-from">,
      "Missing derives-from source"
    >
  | Missing<
      KeysOfKind<Artifacts, "market-requirement">,
      TargetKeys<Relations, "derives-from">,
      "Missing derives-from target"
    >
  | Missing<
      KeysOfKind<Artifacts, "architecture-block">,
      SourceKeys<Relations, "implements">,
      "Missing implements source"
    >
  | Missing<
      KeysOfKind<
        Artifacts,
        "software-requirement" | "non-functional-requirement"
      >,
      TargetKeys<Relations, "implements">,
      "Missing implements target"
    >
  | Missing<
      KeysOfKind<Artifacts, "test-case">,
      SourceKeys<Relations, "verifies">,
      "Missing verifies source"
    >
  | Missing<
      CriterionKeys<Artifacts>,
      VerifiedCriterionKeys<Relations>,
      "Missing verifies target"
    >
  | Missing<
      VerifiedCriterionKeys<Relations>,
      CriterionKeys<Artifacts>,
      "Missing acceptance criterion"
    >
  | Missing<
      KeysOfKind<Artifacts, "risk">,
      TargetKeys<Relations, "verifies">,
      "Missing verifies target"
    >
  | Missing<
      KeysOfKind<Artifacts, "sprint">,
      SourceKeys<Relations, "delivers">,
      "Missing delivers source"
    >
  | Missing<
      KeysOfKind<Artifacts, Exclude<ArtifactKind, "sprint">>,
      TargetKeys<Relations, "delivers">,
      "Missing delivers target"
    >
  | Missing<
      KeysOfKind<Artifacts, "risk">,
      SourceKeys<Relations, "threatens">,
      "Missing threatens source"
    >;

type StaticCheck<
  Project extends string,
  Artifacts extends readonly Artifact[],
  Relations extends readonly Relation[],
> = [StaticProblems<Project, Artifacts, Relations>] extends [never]
  ? unknown
  : {
      readonly __specErrors: readonly StaticProblems<
        Project,
        Artifacts,
        Relations
      >[];
    };

export interface SpecProject<
  Project extends string = string,
  Artifacts extends readonly Artifact[] = readonly Artifact[],
  Relations extends readonly Relation[] = readonly Relation[],
> {
  readonly id: Project;
  readonly title: string;
  readonly overview?: {
    readonly description: string;
    readonly intendedUses?: readonly string[];
    readonly diagrams?: OneOrMore<Diagram>;
  };
  readonly artifacts: Artifacts;
  readonly relations: Relations;
}

export function defineProject<
  const Project extends string,
  const Artifacts extends readonly Artifact[],
  const Relations extends readonly Relation[],
>(
  project: SpecProject<Project, Artifacts, Relations> &
    StaticCheck<Project, Artifacts, Relations>,
): SpecProject<Project, Artifacts, Relations> {
  return Object.freeze(project);
}

export function artifactKey(value: Identity): string {
  return `${value.kind}:${value.id}`;
}

export function buildGraph(project: SpecProject) {
  const artifacts = new Map(
    project.artifacts.map((value) => [artifactKey(value), value]),
  );
  const incoming = new Map<string, Relation[]>();
  const outgoing = new Map<string, Relation[]>();

  for (const relation of project.relations) {
    const from = artifactKey(relation.from);
    const to = artifactKey(relation.to);
    outgoing.set(from, [...(outgoing.get(from) ?? []), relation]);
    incoming.set(to, [...(incoming.get(to) ?? []), relation]);
  }

  return { artifacts, incoming, outgoing } as const;
}

export function validateProject(project: SpecProject): readonly string[] {
  const problems = diagramTitleProblems(
    project.overview?.diagrams,
    `project:${project.id}`,
  );
  problems.push(...architectureOverviewProblems(project));
  const artifactKeys = new Set<string>();
  const relationKeys = new Set<string>();
  const criterionKeys = new Set<string>();
  const verifiedCriteria = new Set<string>();

  for (const artifact of project.artifacts) {
    const key = artifactKey(artifact);
    if (artifactKeys.has(key)) problems.push(`Duplicate artifact: ${key}`);
    artifactKeys.add(key);
    if ("acceptanceCriteria" in artifact) {
      if (!artifact.acceptanceCriteria.length)
        problems.push(`Acceptance criteria are required: ${key}`);
      for (const criterion of artifact.acceptanceCriteria) {
        const criterionKey = `${key}:${criterion.id}`;
        if (
          typeof criterion.id !== "string" ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(criterion.id)
        )
          problems.push(`Invalid acceptance criterion ID: ${criterionKey}`);
        if (
          typeof criterion.description !== "string" ||
          !criterion.description.trim()
        )
          problems.push(
            `Acceptance criterion description is required: ${criterionKey}`,
          );
        if (criterionKeys.has(criterionKey))
          problems.push(`Duplicate acceptance criterion: ${criterionKey}`);
        criterionKeys.add(criterionKey);
      }
    }
    if ("diagrams" in artifact)
      problems.push(...diagramTitleProblems(artifact.diagrams, key));

    if (artifact.kind === "architecture-block") {
      if (!artifact.summaryDiagram)
        problems.push(`Summary diagram is required: ${key}`);
      else {
        problems.push(
          ...diagramTitleProblems(
            [artifact.summaryDiagram],
            `${key}.summaryDiagram`,
          ),
        );
        if (
          !isFigure(artifact.summaryDiagram) &&
          (artifact.summaryDiagram.language !== "mermaid" ||
            !artifact.summaryDiagram.source.trim())
        )
          problems.push(
            `Summary diagram must be Excalidraw or nonempty Mermaid: ${key}`,
          );
      }
    }

    if (artifact.kind === "sprint") {
      const tasks = flattenTasks([
        ...artifact.tasks,
        ...artifact.architectureReview,
        ...artifact.documentationIntegrity,
      ]);
      if (artifact.status === "completed" && tasks.some((task) => !task.done)) {
        problems.push(`Completed sprint has open tasks: ${key}`);
      }
      if (
        artifact.startDate &&
        artifact.endDate &&
        Date.parse(artifact.startDate) > Date.parse(artifact.endDate)
      ) {
        problems.push(`Sprint ends before it starts: ${key}`);
      }
    }
  }

  for (const relation of project.relations) {
    const from = artifactKey(relation.from);
    const to = artifactKey(relation.to);
    const criterion =
      relation.kind === "verifies" && relation.to.kind !== "risk"
        ? relation.to.criterion
        : undefined;
    const key = `${relation.kind}:${from}:${to}${criterion === undefined ? "" : `:${criterion}`}`;
    if (!artifactKeys.has(from))
      problems.push(`Missing relation source: ${from}`);
    if (!artifactKeys.has(to)) problems.push(`Missing relation target: ${to}`);
    if (relationKeys.has(key)) problems.push(`Duplicate relation: ${key}`);
    relationKeys.add(key);
    if (relation.kind === "verifies" && relation.to.kind !== "risk") {
      if (typeof criterion !== "string" || !criterion) {
        problems.push(
          `Verification must target an acceptance criterion: ${to}`,
        );
      } else {
        const criterionKey = `${to}:${criterion}`;
        if (!criterionKeys.has(criterionKey))
          problems.push(`Missing acceptance criterion: ${criterionKey}`);
        else if (
          project.artifacts.some(
            (artifact) =>
              artifactKey(artifact) === from &&
              artifact.kind === "test-case" &&
              artifact.project === project.id &&
              relation.from.project === project.id &&
              relation.to.project === project.id,
          )
        )
          verifiedCriteria.add(criterionKey);
      }
    }
  }

  for (const key of criterionKeys)
    if (!verifiedCriteria.has(key))
      problems.push(`Missing verifies target: ${key}`);

  return problems;
}

function architectureOverviewProblems(project: SpecProject): string[] {
  const blocks = project.artifacts.filter(
    (artifact) => artifact.kind === "architecture-block",
  );
  const diagrams =
    project.overview?.diagrams?.filter(isArchitectureDiagram) ?? [];
  if (blocks.length && !diagrams.length)
    return ["Architecture overview diagram is required."];

  const problems: string[] = [];
  const registered = new Map(
    blocks.map((block) => [artifactKey(block), block]),
  );
  for (const diagram of diagrams) {
    const seen = new Set<string>();
    for (const block of diagram.blocks) {
      const key = artifactKey(block);
      const canonical = registered.get(key);
      if (
        !canonical ||
        canonical.project !== block.project ||
        block.project !== project.id
      )
        problems.push(
          `Unknown architecture overview block: ${block.project}:${key}`,
        );
      else if (canonical.title !== block.title)
        problems.push(`Stale architecture overview block title: ${key}`);
      if (seen.has(key))
        problems.push(`Duplicate architecture overview block: ${key}`);
      seen.add(key);
    }
    for (const block of blocks)
      if (!seen.has(artifactKey(block)))
        problems.push(
          `Missing architecture overview block: ${artifactKey(block)}`,
        );
    for (const connection of isFigure(diagram) ? [] : diagram.connections) {
      for (const block of [connection.from, connection.to]) {
        if (block.project !== project.id || !seen.has(artifactKey(block)))
          problems.push(
            `Architecture overview connection references an undeclared block: ${block.project}:${artifactKey(block)}`,
          );
      }
    }
    if (
      !isFigure(diagram) &&
      (diagram.language !== "mermaid" ||
        diagram.source !== architectureDiagramSource(diagram))
    )
      problems.push(
        `Architecture overview diagram source does not match its blocks and connections: ${diagram.title}`,
      );
  }
  return problems;
}

function diagramTitleProblems(
  diagrams: readonly Diagram[] | undefined,
  owner: string,
): string[] {
  return (diagrams ?? []).flatMap((diagram, index) => [
    ...(typeof diagram.title !== "string" || !diagram.title.trim()
      ? [`Diagram title is required: ${owner}.diagrams[${index}]`]
      : []),
    ...("excalidraw" in diagram &&
    (typeof diagram.excalidraw !== "string" ||
      !diagram.excalidraw.endsWith(figureSuffix))
      ? [
          `Figure must reference a ${figureSuffix} file: ${owner}.diagrams[${index}]`,
        ]
      : []),
  ]);
}

function flattenTasks(tasks: readonly Task[]): readonly Task[] {
  return tasks.flatMap((task) => [task, ...flattenTasks(task.children ?? [])]);
}
