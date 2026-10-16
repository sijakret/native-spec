import { artifact } from "../factory.js";

export const plaintextLeak = artifact.risk({
  id: "RISK-001",
  title: "Plaintext Leak",
  level: "high",
  tags: ["security"],
  description: "The search index could store note content unencrypted.",
  mitigation: ["Encrypt the index with the same key as the notes."],
  impact: "Private notes become readable from disk.",
});
