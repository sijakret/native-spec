import {
  artifactKey,
  buildGraph,
  type Artifact,
  type ArtifactKind,
  type Relation,
} from "../../definition/process.js";

export const sections: readonly {
  readonly kind: ArtifactKind;
  readonly title: string;
}[] = [
  { kind: "market-requirement", title: "Market Requirements" },
  { kind: "software-requirement", title: "Software Requirements" },
  {
    kind: "non-functional-requirement",
    title: "Non-Functional Requirements",
  },
  { kind: "architecture-block", title: "Architecture Building Blocks" },
  { kind: "test-case", title: "Test Cases" },
  { kind: "risk", title: "Risks" },
  { kind: "sprint", title: "Sprints" },
];

export const relationLabels: Record<
  Relation["kind"],
  { readonly outgoing: string; readonly incoming: string }
> = {
  "derives-from": { outgoing: "Derived from", incoming: "Refined by" },
  implements: { outgoing: "Implements", incoming: "Implemented by" },
  verifies: { outgoing: "Tests", incoming: "Tested by" },
  delivers: { outgoing: "Delivers", incoming: "Delivered by" },
  threatens: { outgoing: "Threatens", incoming: "Threatened by" },
};

export interface RelationGroup {
  readonly kind: Relation["kind"];
  readonly direction: "outgoing" | "incoming";
  readonly label: string;
  readonly artifacts: readonly Artifact[];
  readonly targets: readonly RelationTarget[];
}

export interface RelationTarget {
  readonly artifact: Artifact;
  readonly criterion?: string;
}

export function artifactAnchor(artifact: Pick<Artifact, "id">): string {
  return artifact.id.toLowerCase();
}

export function criterionAnchor(
  artifact: Pick<Artifact, "id">,
  criterion: string,
): string {
  return `${artifactAnchor(artifact)}-ac-${criterion}`;
}

export function artifactAnchors(artifact: Artifact): readonly string[] {
  return [
    artifactAnchor(artifact),
    ...("acceptanceCriteria" in artifact
      ? artifact.acceptanceCriteria.map((criterion) =>
          criterionAnchor(artifact, criterion.id),
        )
      : []),
  ];
}

export function criterionTests(
  graph: ReturnType<typeof buildGraph>,
  artifact: Artifact,
  criterion: string,
): readonly Artifact[] {
  return (graph.incoming.get(artifactKey(artifact)) ?? []).flatMap(
    (relation) => {
      if (
        relation.kind !== "verifies" ||
        relation.to.kind === "risk" ||
        relation.to.criterion !== criterion
      )
        return [];
      const test = graph.artifacts.get(artifactKey(relation.from));
      if (!test)
        throw new Error(`Cannot render missing test case: ${relation.from.id}`);
      return [test];
    },
  );
}

export function sectionAnchor(kind: ArtifactKind): string {
  return `section-${kind}`;
}

export function groupRelations(
  outgoing: readonly Relation[],
  incoming: readonly Relation[],
  artifacts: ReadonlyMap<string, Artifact>,
): readonly RelationGroup[] {
  const groups = new Map<string, RelationGroup>();

  for (const [relations, direction] of [
    [outgoing, "outgoing"],
    [incoming, "incoming"],
  ] as const) {
    for (const relation of relations) {
      const reference = direction === "outgoing" ? relation.to : relation.from;
      const artifact = artifacts.get(artifactKey(reference));
      if (!artifact) {
        throw new Error(
          `Cannot render dangling relation: ${relation.kind}:${relation.from.id}:${relation.to.id}`,
        );
      }

      const label = relationLabels[relation.kind][direction];
      const previous = groups.get(label);
      const criterion =
        direction === "outgoing" &&
        relation.kind === "verifies" &&
        relation.to.kind !== "risk"
          ? relation.to.criterion
          : undefined;
      const targets = previous?.targets ?? [];
      groups.set(label, {
        kind: relation.kind,
        direction,
        label,
        artifacts: previous?.artifacts.some(
          (value) => artifactKey(value) === artifactKey(artifact),
        )
          ? previous.artifacts
          : [...(previous?.artifacts ?? []), artifact],
        targets: targets.some(
          (value) =>
            artifactKey(value.artifact) === artifactKey(artifact) &&
            value.criterion === criterion,
        )
          ? targets
          : [
              ...targets,
              { artifact, ...(criterion === undefined ? {} : { criterion }) },
            ],
      });
    }
  }

  return [...groups.values()];
}

export function relationPeers(
  graph: ReturnType<typeof buildGraph>,
  current: Artifact,
  related: Artifact,
  group: Pick<RelationGroup, "kind" | "direction">,
): readonly Artifact[] {
  const edges =
    group.direction === "outgoing"
      ? graph.incoming.get(artifactKey(related))
      : graph.outgoing.get(artifactKey(related));
  const peers = new Map<string, Artifact>();
  for (const edge of edges ?? []) {
    if (edge.kind !== group.kind) continue;
    const reference = group.direction === "outgoing" ? edge.from : edge.to;
    if (reference.kind !== current.kind) continue;
    const key = artifactKey(reference);
    const peer = graph.artifacts.get(key);
    if (!peer) throw new Error(`Cannot count missing relation peer: ${key}`);
    peers.set(key, peer);
  }
  if (!peers.has(artifactKey(current)))
    throw new Error(
      `No ${group.kind} link between ${current.id} and ${related.id} in this direction.`,
    );
  return [...peers.values()];
}
