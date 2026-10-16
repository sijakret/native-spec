import {
  artifactKey,
  type Artifact,
  type ArtifactKind,
  type Relation,
} from "../../definition/engine.js";

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

const relationLabels: Record<
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
  readonly label: string;
  readonly artifacts: readonly Artifact[];
}

export function artifactAnchor(artifact: Pick<Artifact, "id">): string {
  return artifact.id.toLowerCase();
}

export function sectionAnchor(kind: ArtifactKind): string {
  return `section-${kind}`;
}

export function groupRelations(
  outgoing: readonly Relation[],
  incoming: readonly Relation[],
  artifacts: ReadonlyMap<string, Artifact>,
): readonly RelationGroup[] {
  const groups = new Map<string, Artifact[]>();

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
      groups.set(label, [...(groups.get(label) ?? []), artifact]);
    }
  }

  return [...groups].map(([label, relatedArtifacts]) => ({
    label,
    artifacts: relatedArtifacts,
  }));
}
