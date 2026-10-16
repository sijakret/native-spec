import { artifact, completedTask } from "../factory.js";

export const firstSliceSprint = artifact.sprint({
  id: "SPRINT-0001",
  title: "First Slice",
  status: "completed",
  startDate: "2026-09-01",
  endDate: "2026-09-12",
  description: "Save and find encrypted notes end to end.",
  diagrams: [
    {
      language: "mermaid",
      source: `sequenceDiagram
  User->>UI: Save note
  UI->>NoteStore: save(note)
  NoteStore-->>UI: Searchable immediately`,
    },
  ],
  verification: ["Run the note store suite."],
  tasks: [
    completedTask("Specify requirements, architecture, tests, and risks."),
    completedTask("Implement the encrypted note store and search index."),
    completedTask("Pass the note store suite."),
  ],
  architectureReview: [
    completedTask("ABB-001 describes storage and index ownership."),
  ],
  documentationIntegrity: [
    completedTask("Test references point to existing tests."),
  ],
});
