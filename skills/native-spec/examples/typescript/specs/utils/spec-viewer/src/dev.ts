import { buildGraph } from "../../../definition/engine.js";
import project from "../../../definition/project.js";
import { renderSpecPanel } from "../../output/html.js";
import { artifactAnchor } from "../../output/rendering.js";
import { mount, showError } from "./webview/view.js";
import "./webview/styles.css";

const app = document.getElementById("app")!;
const graph = buildGraph(project);

async function render(): Promise<void> {
  const anchor = location.hash.slice(1);
  if (anchor === "spec-content") return;
  const artifact = project.artifacts.find(
    (candidate) => artifactAnchor(candidate) === anchor,
  );
  if (anchor && anchor !== "spec-overview" && !artifact) {
    showError(app, `Unknown artifact: ${anchor}`);
    return;
  }
  try {
    await mount(
      app,
      renderSpecPanel(graph, project, artifact ? [artifact] : undefined),
    );
    window.scrollTo(0, 0);
  } catch (error) {
    showError(app, error);
  }
}

window.addEventListener("hashchange", () => void render());
void render();
