import type {
  AcceptanceCriterion,
  Artifact,
  ArtifactKind,
  Diagram,
  Task,
} from "../../definition/process.js";

interface Paragraph {
  readonly kind: "paragraph";
}
interface Inline {
  readonly kind: "inline";
  readonly label: string;
}
interface List {
  readonly kind: "list";
  readonly label: string;
  readonly ordered?: true;
}
interface Code {
  readonly kind: "code";
}
interface SingleDiagram {
  readonly kind: "diagram";
}
interface Tasks {
  readonly kind: "tasks";
  readonly label: string;
}
interface Criteria {
  readonly kind: "criteria";
  readonly label: string;
}

export type Field =
  | Paragraph
  | Inline
  | List
  | Code
  | SingleDiagram
  | Tasks
  | Criteria;

// The descriptors permitted for a field type. Unmapped types resolve to never, so a new
// or retyped artifact field cannot compile until a view is declared for it.
type FieldFor<Value> = [Value] extends [string]
  ? Paragraph | Inline
  : [Value] extends [readonly string[]]
    ? List | Inline
    : [Value] extends [Diagram]
      ? SingleDiagram
      : [Value] extends [readonly Diagram[]]
        ? Code
        : [Value] extends [readonly Task[]]
          ? Tasks
          : [Value] extends [readonly AcceptanceCriterion[]]
            ? Criteria
            : never;

type Identity = "project" | "kind" | "id" | "title";

export type View<Value extends Artifact> = {
  readonly [Key in Exclude<keyof Value, Identity>]-?: FieldFor<
    Exclude<Value[Key], undefined>
  >;
};

const paragraph: Paragraph = { kind: "paragraph" };
const inline = (label: string): Inline => ({ kind: "inline", label });
const list = (label: string): List => ({ kind: "list", label });
const steps = (label: string): List => ({ kind: "list", label, ordered: true });
const code: Code = { kind: "code" };
const tasks = (label: string): Tasks => ({ kind: "tasks", label });

const requirement = {
  tags: inline("Tags"),
  description: paragraph,
  acceptanceCriteria: { kind: "criteria", label: "Acceptance Criteria" },
} as const;

// Declaration order is rendering order.
export const views: {
  readonly [Kind in ArtifactKind]: View<Extract<Artifact, { kind: Kind }>>;
} = {
  "market-requirement": requirement,
  "software-requirement": requirement,
  "non-functional-requirement": requirement,
  "architecture-block": {
    tags: inline("Tags"),
    description: paragraph,
    summaryDiagram: { kind: "diagram" },
    diagrams: code,
    responsibilities: list("Responsibilities"),
    files: list("Files and Folders"),
  },
  "test-case": {
    description: paragraph,
    type: inline("Type"),
    code: list("Code"),
    steps: steps("Steps"),
    expected: list("Expected Result"),
  },
  risk: {
    tags: inline("Tags"),
    description: paragraph,
    level: inline("Risk Level"),
    mitigation: list("Mitigation"),
    impact: inline("Impact"),
  },
  sprint: {
    description: paragraph,
    status: inline("Status"),
    startDate: inline("Start Date"),
    endDate: inline("End Date"),
    diagrams: code,
    interfaces: list("Interfaces"),
    dependenciesAndRisks: list("Dependencies And Risks"),
    verification: list("Verification"),
    tasks: tasks("Tasks"),
    implementation: list("Implementation"),
    architectureReview: tasks("Architecture Review"),
    documentationIntegrity: tasks("Documentation Integrity"),
  },
};

type Bound<Descriptor, Value> = Descriptor & {
  readonly key: string;
  readonly value: Value;
};

export type BoundField =
  | Bound<Paragraph, string>
  | Bound<Inline, string | readonly string[]>
  | Bound<List, readonly string[]>
  | Bound<Code, readonly Diagram[]>
  | Bound<SingleDiagram, Diagram>
  | Bound<Tasks, readonly Task[]>
  | Bound<Criteria, readonly AcceptanceCriterion[]>;

// Present fields of one artifact, in view order. Types were checked when `views` was declared.
export function boundFields(artifact: Artifact): readonly BoundField[] {
  const view = views[artifact.kind] as Record<string, Field>;
  const values = artifact as unknown as Record<string, unknown>;
  return Object.entries(view).flatMap(([key, field]) =>
    values[key] === undefined
      ? []
      : [{ ...field, key, value: values[key] } as BoundField],
  );
}
