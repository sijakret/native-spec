import { artifacts } from "../artifacts/index.js";
import { defineProject } from "./engine.js";
import { relations } from "./relations.js";

export const project = defineProject({
  id: "acme-notes",
  title: "Acme Notes",
  overview: {
    description:
      "A private note-taking app: capture in seconds, find anything by what it says.",
    diagrams: [
      {
        language: "mermaid",
        source: `flowchart LR
  User[User] --> UI[UI]
  UI --> Store[ABB-001 Note Store]`,
      },
    ],
  },
  artifacts,
  relations,
});

export default project;
