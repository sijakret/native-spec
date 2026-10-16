import { artifact } from "../factory.js";

export const fullTextSearch = artifact.softwareRequirement({
  id: "REQ-SR-001",
  title: "Full-Text Search",
  tags: ["search"],
  description: "Search matches words anywhere in a note's title or body.",
  acceptanceCriteria: [
    "Results rank title matches above body matches.",
    "A newly saved note is searchable immediately.",
  ],
});
