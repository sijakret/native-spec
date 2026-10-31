import { artifacts, relations } from "../artifacts/index.js";
import { architectureOverview } from "../artifacts/architecture/000-architecture.js";
import { defineProject } from "./process.js";

export const project = defineProject({
  id: "acme-stockroom",
  title: "Acme Stockroom",
  overview: architectureOverview,
  artifacts,
  relations,
});

export default project;
