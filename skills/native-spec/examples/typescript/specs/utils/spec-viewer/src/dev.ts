import { buildGraph, validateProject } from "../../../definition/process.js";
import project from "../../../definition/project.js";
import { renderSpecPanel } from "../../output/html.js";
import { artifactAnchors } from "../../output/rendering.js";
import { mount, showError } from "./webview/view.js";
import "./webview/styles.css";

const app = document.getElementById("app")!;
const graph = buildGraph(project);
const theme = document.createElement("select");
theme.className = "preview-theme";
theme.setAttribute("aria-label", "Preview theme");
theme.title = "Preview theme";
theme.append(
  new Option("System", "auto"),
  new Option("Light", "light"),
  new Option("Dark", "dark"),
);
const savedTheme = localStorage.getItem("native-spec-preview-theme");
theme.value =
  savedTheme === "light" || savedTheme === "dark" ? savedTheme : "auto";
const applyTheme = (): void => {
  document.documentElement.style.colorScheme =
    theme.value === "auto" ? "light dark" : theme.value;
};
theme.addEventListener("change", () => {
  applyTheme();
  localStorage.setItem("native-spec-preview-theme", theme.value);
});
applyTheme();

async function render(): Promise<void> {
  const anchor = location.hash.slice(1);
  if (anchor === "spec-content") return;
  const artifact = project.artifacts.find((candidate) =>
    artifactAnchors(candidate).includes(anchor),
  );
  if (
    anchor &&
    anchor !== "spec-overview" &&
    anchor !== "spec-architecture" &&
    !artifact
  ) {
    showError(app, `Unknown artifact: ${anchor}`);
    return;
  }
  try {
    const page =
      !anchor || anchor === "spec-architecture" ? "architecture" : "overview";
    if (!artifact && page === "architecture") {
      const problems = validateProject(project);
      if (problems.length) throw new Error(problems.join("\n"));
    }
    await mount(
      app,
      renderSpecPanel(graph, project, artifact ? [artifact] : undefined, page),
    );
    app.querySelector(".spec-toolbar")?.append(theme);
    window.scrollTo(0, 0);
    if (anchor !== "spec-architecture" && anchor !== "spec-overview")
      document.getElementById(anchor)?.scrollIntoView();
  } catch (error) {
    showError(app, error);
  }
}

window.addEventListener("hashchange", () => void render());
void render();
