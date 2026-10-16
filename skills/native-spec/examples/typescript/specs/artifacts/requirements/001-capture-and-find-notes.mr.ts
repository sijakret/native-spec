import { artifact } from "../factory.js";

export const captureAndFindNotes = artifact.marketRequirement({
  id: "REQ-MR-001",
  title: "Capture and Find Notes",
  tags: ["notes"],
  description:
    "People capture thoughts in seconds and find them again without organizing anything up front.",
  acceptanceCriteria: [
    "A new note is saved with a single action.",
    "Any saved note can be found again by what it says.",
  ],
});
