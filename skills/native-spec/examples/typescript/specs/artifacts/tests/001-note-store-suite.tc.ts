import { artifact } from "../factory.js";

export const noteStoreSuite = artifact.testCase({
  id: "TC-001",
  title: "Note Store Suite",
  type: "automated",
  code: ["tests/store.test.ts"],
  description: "Save, search, and inspect stored notes.",
  steps: [
    "Save notes whose titles and bodies share a search term.",
    "Search for the term and read the raw storage file.",
  ],
  expected: [
    "Title matches rank first and new notes appear immediately.",
    "The storage file contains no plaintext note content.",
  ],
});
