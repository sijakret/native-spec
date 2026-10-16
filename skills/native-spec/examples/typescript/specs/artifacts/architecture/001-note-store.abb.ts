import { artifact } from "../factory.js";

export const noteStore = artifact.architectureBlock({
  id: "ABB-001",
  title: "Note Store",
  tags: ["storage", "search"],
  description:
    "Owns persistence and the search index. The UI talks to it only through the NoteStore interface.",
  diagrams: [
    {
      language: "mermaid",
      source: `flowchart LR
  UI[UI] --> Store[NoteStore]
  Store --> Crypto[Encrypt at rest]
  Store --> Index[Search index]`,
    },
  ],
  responsibilities: [
    "Encrypt notes before they touch disk.",
    "Update the search index in the same write as the note.",
  ],
  files: ["src/store", "tests/store.test.ts"],
});
