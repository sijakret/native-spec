import { noteStore } from "./architecture/001-note-store.abb.js";
import { captureAndFindNotes } from "./requirements/001-capture-and-find-notes.mr.js";
import { privateByDefault } from "./requirements/001-private-by-default.nfr.js";
import { fullTextSearch } from "./requirements/001-full-text-search.sr.js";
import { plaintextLeak } from "./risks/001-plaintext-leak.risk.js";
import { firstSliceSprint } from "./sprints/0001-first-slice.sprint.js";
import { noteStoreSuite } from "./tests/001-note-store-suite.tc.js";

export {
  captureAndFindNotes,
  firstSliceSprint,
  fullTextSearch,
  noteStore,
  noteStoreSuite,
  plaintextLeak,
  privateByDefault,
};

export const artifacts = [
  captureAndFindNotes,
  fullTextSearch,
  privateByDefault,
  noteStore,
  noteStoreSuite,
  plaintextLeak,
  firstSliceSprint,
] as const;
