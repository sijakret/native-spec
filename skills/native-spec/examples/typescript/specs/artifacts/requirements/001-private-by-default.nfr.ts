import { artifact } from "../factory.js";

export const privateByDefault = artifact.nonFunctionalRequirement({
  id: "REQ-NFR-001",
  title: "Private by Default",
  tags: ["security"],
  description: "Note content never leaves the device unencrypted.",
  acceptanceCriteria: [
    "Notes are encrypted at rest.",
    "Logs and telemetry never contain note content.",
  ],
});
