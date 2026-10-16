import { buildGraph } from "../../../definition/engine.js";
import project from "../../../definition/project.js";
import { renderArtifactFragment } from "../../output/html.js";
import { mount } from "./webview/view.js";
import "./webview/styles.css";

void mount(
  document.getElementById("app")!,
  renderArtifactFragment(buildGraph(project), project.artifacts, project),
);
