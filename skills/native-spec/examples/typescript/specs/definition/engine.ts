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

interface RequirementFields {
  readonly tags: OneOrMore<string>;
  readonly description: string;
  readonly acceptanceCriteria: OneOrMore<string>;
}

export type MarketRequirement<
  Project extends string = string,
  Id extends MarketRequirementId = MarketRequirementId,
> = BaseArtifact<Project, "market-requirement", Id> & RequirementFields;

export type SoftwareRequirement<
  Project extends string = string,
  Id extends SoftwareRequirementId = SoftwareRequirementId,
> = BaseArtifact<Project, "software-requirement", Id> & RequirementFields;

export type NonFunctionalRequirement<
  Project extends string = string,
  Id extends NonFunctionalRequirementId = NonFunctionalRequirementId,
> = BaseArtifact<Project, "non-functional-requirement", Id> & RequirementFields;

export interface CodeBlock {
  readonly language: string;
  readonly source: string;
}

export type ArchitectureBlock<
  Project extends string = string,
  Id extends ArchitectureBlockId = ArchitectureBlockId,
> = BaseArtifact<Project, "architecture-block", Id> & {
  readonly tags: OneOrMore<string>;
  readonly description: string;
  readonly responsibilities: OneOrMore<string>;
  readonly files?: OneOrMore<string>;
  readonly diagrams?: OneOrMore<CodeBlock>;
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
  readonly diagrams?: OneOrMore<CodeBlock>;
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
    marketRequirement<const Id extends MarketRequirementId>(
      value: ArtifactInput<MarketRequirement<Project, Id>>,
    ): MarketRequirement<Project, Id> {
      return create("market-requirement", value);
    },
    softwareRequirement<const Id extends SoftwareRequirementId>(
      value: ArtifactInput<SoftwareRequirement<Project, Id>>,
    ): SoftwareRequirement<Project, Id> {
      return create("software-requirement", value);
    },
    nonFunctionalRequirement<const Id extends NonFunctionalRequirementId>(
      value: ArtifactInput<NonFunctionalRequirement<Project, Id>>,
    ): NonFunctionalRequirement<Project, Id> {
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

export type Verifies = DirectedRelation<
  "verifies",
  ArtifactRef<string, "test-case", TestCaseId>,
  ArtifactRef<
    string,
    | "market-requirement"
    | "software-requirement"
    | "non-functional-requirement"
    | "risk",
    | MarketRequirementId
    | SoftwareRequirementId
    | NonFunctionalRequirementId
    | RiskId
  >
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
  const To extends Requirement<From["project"]> | Risk<From["project"]>,
>(from: From, to: To) {
  return edge("verifies", from, to);
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
      KeysOfKind<
        Artifacts,
        | "market-requirement"
        | "software-requirement"
        | "non-functional-requirement"
        | "risk"
      >,
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
    readonly diagrams?: OneOrMore<CodeBlock>;
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
  const problems: string[] = [];
  const artifactKeys = new Set<string>();
  const relationKeys = new Set<string>();

  for (const artifact of project.artifacts) {
    const key = artifactKey(artifact);
    if (artifactKeys.has(key)) problems.push(`Duplicate artifact: ${key}`);
    artifactKeys.add(key);

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
    const key = `${relation.kind}:${from}:${to}`;
    if (!artifactKeys.has(from))
      problems.push(`Missing relation source: ${from}`);
    if (!artifactKeys.has(to)) problems.push(`Missing relation target: ${to}`);
    if (relationKeys.has(key)) problems.push(`Duplicate relation: ${key}`);
    relationKeys.add(key);
  }

  return problems;
}

function flattenTasks(tasks: readonly Task[]): readonly Task[] {
  return tasks.flatMap((task) => [task, ...flattenTasks(task.children ?? [])]);
}
