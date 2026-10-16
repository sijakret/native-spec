import {
  captureAndFindNotes,
  firstSliceSprint,
  fullTextSearch,
  noteStore,
  noteStoreSuite,
  plaintextLeak,
  privateByDefault,
} from "../artifacts/index.js";
import {
  delivers,
  derivesFrom,
  implementsRequirement,
  threatens,
  verifies,
} from "./engine.js";

// Each canonical relation once; incoming views are derived by buildGraph.
export const relations = [
  derivesFrom(fullTextSearch, captureAndFindNotes),
  implementsRequirement(noteStore, fullTextSearch),
  implementsRequirement(noteStore, privateByDefault),
  verifies(noteStoreSuite, captureAndFindNotes),
  verifies(noteStoreSuite, fullTextSearch),
  verifies(noteStoreSuite, privateByDefault),
  verifies(noteStoreSuite, plaintextLeak),
  threatens(plaintextLeak, privateByDefault),
  delivers(firstSliceSprint, captureAndFindNotes),
  delivers(firstSliceSprint, fullTextSearch),
  delivers(firstSliceSprint, privateByDefault),
  delivers(firstSliceSprint, noteStore),
  delivers(firstSliceSprint, noteStoreSuite),
  delivers(firstSliceSprint, plaintextLeak),
] as const;
