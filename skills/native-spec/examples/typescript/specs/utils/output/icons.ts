import type { ArtifactKind } from "../../definition/process.js";

type Icon = ArtifactKind | "project" | "source";

const shapes: Record<Icon, string> = {
  project:
    '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/><path d="M9 4.5h2.5V9M7 11.5H4.5V7"/>',
  "market-requirement":
    '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><path d="M8 6.5v3M6.5 8h3"/>',
  "software-requirement":
    '<rect x="2.5" y="1.5" width="11" height="13" rx="1"/><path d="m5 5 1 1 2-2M9.5 5h1.5M5 9h6M5 12h6"/>',
  "non-functional-requirement":
    '<path d="m8 1.5 5.5 2v4c0 3-2.5 5.5-5.5 7-3-1.5-5.5-4-5.5-7v-4z"/><path d="m5 8 2 2 4-4"/>',
  "architecture-block":
    '<rect x="5.5" y="1.5" width="5" height="4" rx=".5"/><rect x="1" y="10.5" width="5" height="4" rx=".5"/><rect x="10" y="10.5" width="5" height="4" rx=".5"/><path d="M8 5.5v3M3.5 10.5v-2h9v2"/>',
  "test-case":
    '<path d="M5.5 1.5h5M6.5 1.5v4l-4 7a1 1 0 0 0 1 2h9a1 1 0 0 0 1-2l-4-7v-4M5 9h6"/>',
  risk:
    '<path d="m8 1.5 6.5 12h-13zM8 6v3.5M8 11.5v.5"/>',
  sprint:
    '<rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1.5v3M11 1.5v3M2 6.5h12M5 10h6m-2-2 2 2-2 2"/>',
  source: '<path d="m5.5 4-4 4 4 4M10.5 4l4 4-4 4M9 2.5l-2 11"/>',
};

export function specIcon(kind: Icon): string {
  return `<svg class="spec-icon" data-icon="${kind}" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[kind]}</svg>`;
}
