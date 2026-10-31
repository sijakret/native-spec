import mermaid from "mermaid";
import { specIcon } from "../../../output/icons.js";
import { parseFieldPath, type PathSegment } from "../edits.js";
import { fitLabelMasks, themedFigure } from "./figure-theme.js";

export interface SourceTarget {
  readonly path?: readonly PathSegment[];
  readonly anchor?: string;
}

type OpenSource = (target: SourceTarget) => void;

// Resolves an Excalidraw sidecar URL (as produced by `figure()`) to a loadable href.
export interface FigureHost {
  href(url: string): string;
}

let figureHost: FigureHost = { href: (url) => url };

const observed = new WeakSet<HTMLElement>();
let diagramQueue = Promise.resolve();
let relationSplit = 50;

export async function mount(
  container: HTMLElement,
  html: string,
  openSource?: OpenSource,
  figures?: FigureHost,
): Promise<void> {
  container.classList.remove("editable");
  container.innerHTML = html;
  figureHost = figures ?? { href: (url) => url };
  for (const figure of container.querySelectorAll<HTMLElement>(
    ".excalidraw-figure",
  ))
    showFigureImage(figure);
  for (const link of container.querySelectorAll<HTMLAnchorElement>(
    "a.figure-ref",
  ))
    link.href = figureHost.href(link.dataset.excalidraw!);

  for (const code of container.querySelectorAll<HTMLElement>(
    "code.language-mermaid",
  )) {
    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.dataset.source = code.textContent;
    const block = code.parentElement ?? code;
    if (block.dataset.sourcePath)
      diagram.dataset.sourcePath = block.dataset.sourcePath;
    block.replaceWith(diagram);
  }
  const source =
    container.querySelector<HTMLButtonElement>("[data-open-source]");
  if (source) {
    source.disabled = !openSource;
    if (openSource) source.addEventListener("click", () => openSource({}));
    else source.title = "Source navigation is available in VS Code.";
  }
  if (openSource) addSourceActions(container, openSource);
  resizeRelationColumns(container);
  if (!observed.has(container)) {
    observed.add(container);
    let scheduled = false;
    const refresh = (): void => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        void renderDiagrams(container).catch((error: unknown) =>
          showError(container, error),
        );
      });
    };
    const observer = new MutationObserver(refresh);
    const options: MutationObserverInit = {
      attributes: true,
      attributeFilter: ["class", "style", "data-vscode-theme-id"],
    };
    observer.observe(document.body, options);
    observer.observe(document.documentElement, options);
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      refresh,
    );
  }
  await renderDiagrams(container);
}

function resizeRelationColumns(container: HTMLElement): void {
  const handles = container.querySelectorAll<HTMLElement>(".relation-resizer");
  if (!handles.length) return;
  const setSplit = (value: number): void => {
    relationSplit = Math.round(Math.max(20, Math.min(80, value)));
    container.style.setProperty("--relation-split", `${relationSplit}%`);
    for (const handle of handles) {
      handle.setAttribute("aria-valuenow", String(relationSplit));
      handle.setAttribute(
        "aria-valuetext",
        `${relationSplit}% left, ${100 - relationSplit}% right`,
      );
    }
  };
  setSplit(relationSplit);
  for (const handle of handles) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const card = handle.closest<HTMLElement>(".relation-card")!;
      setSplit(
        ((event.clientX - card.getBoundingClientRect().left - card.clientLeft) /
          card.clientWidth) *
          100,
      );
    });
    handle.addEventListener("dblclick", () => setSplit(50));
    handle.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowLeft":
          setSplit(relationSplit - 5);
          break;
        case "ArrowRight":
          setSplit(relationSplit + 5);
          break;
        case "Home":
          setSplit(20);
          break;
        case "End":
          setSplit(80);
          break;
        default:
          return;
      }
      event.preventDefault();
    });
  }
}

function sourceButton(
  title: string,
  openSource: OpenSource,
  target: SourceTarget,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "source-action";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = specIcon("source");
  button.addEventListener("click", () => openSource(target));
  return button;
}

function addSourceActions(
  container: HTMLElement,
  openSource: OpenSource,
): void {
  for (const heading of container.querySelectorAll<HTMLElement>(
    ".spec-document .artifact-heading",
  )) {
    heading.classList.add("source-target");
    heading.append(
      sourceButton("Open heading in source", openSource, { path: ["id"] }),
    );
  }
  for (let field of container.querySelectorAll<HTMLElement>(
    ".spec-document [data-path], .spec-document [data-source-path], .spec-document [data-source-anchor]",
  )) {
    if (field instanceof HTMLInputElement || field.closest(".artifact-heading"))
      continue;
    const anchor = field.dataset.sourceAnchor;
    const path = field.dataset.sourcePath ?? field.dataset.path;
    if (field instanceof HTMLLIElement) {
      const content = document.createElement("span");
      if (field.dataset.path) content.dataset.path = field.dataset.path;
      if (field.dataset.sourcePath)
        content.dataset.sourcePath = field.dataset.sourcePath;
      content.append(...field.childNodes);
      delete field.dataset.path;
      delete field.dataset.sourcePath;
      field.append(content);
      field = content;
    }
    const block =
      field.matches(
        "p, pre, .diagram, .excalidraw-figure, .spec-list-content",
      ) || field.closest(".spec-catalog");
    const wrapper = document.createElement(block ? "div" : "span");
    wrapper.className = `source-target${block ? " source-target-block" : ""}`;
    field.before(wrapper);
    wrapper.append(
      field,
      sourceButton(
        `Open ${anchor ? field.textContent.trim() : path} in source`,
        openSource,
        anchor ? { anchor } : { path: parseFieldPath(path!) },
      ),
    );
  }
}

document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    "a.figure-ref",
  );
  if (!link) return;
  event.preventDefault();
  showFigureDialog(link.dataset.excalidraw!, link.textContent);
});

function showFigureImage(figure: HTMLElement): void {
  const url = figure.dataset.excalidraw!;
  const title = figure.dataset.title ?? "";
  figure.classList.remove("missing");
  figure.replaceChildren();
  const source = fetch(figureHost.href(url)).then((response) => {
    if (!response.ok || !response.headers.get("content-type")?.includes("svg"))
      throw new Error(
        `Figure not drawn yet: ${decodeURIComponent(url.split("/").pop() ?? url)}`,
      );
    return response.text();
  });
  void source
    .then((text) => {
      const svg = themedFigure(text, title);
      figure.prepend(svg);
      fitLabelMasks(svg);
      void document.fonts.ready.then(() => fitLabelMasks(svg));
    })
    .catch((error: unknown) => {
      figure.classList.add("missing");
      const placeholder = document.createElement("span");
      placeholder.className = "figure-missing";
      placeholder.textContent =
        error instanceof Error ? error.message : String(error);
      figure.prepend(placeholder);
    });
}

function showFigureDialog(url: string, title: string): void {
  const dialog = document.createElement("dialog");
  dialog.className = "figure-dialog";
  dialog.setAttribute("aria-label", title);
  const header = document.createElement("header");
  const heading = document.createElement("h2");
  heading.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => dialog.close());
  header.append(heading, close);
  const figure = document.createElement("span");
  figure.className = "excalidraw-figure";
  figure.dataset.excalidraw = url;
  figure.dataset.title = title;
  dialog.append(header, figure);
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  showFigureImage(figure);
  dialog.showModal();
}

function isDarkTheme(styles: CSSStyleDeclaration): boolean {
  return (
    styles.colorScheme === "dark" ||
    (styles.colorScheme === "light dark" &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function renderDiagrams(container: HTMLElement): Promise<void> {
  const render = async (): Promise<void> => {
    const nodes = container.querySelectorAll<HTMLElement>(
      ".diagram[data-source]",
    );
    if (nodes.length === 0) return;
    const styles = getComputedStyle(document.body);
    const token = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;
    const darkMode = isDarkTheme(styles);
    const boxFill = token(
      "--vscode-button-secondaryBackground",
      darkMode ? "#3a3d41" : "#e5e5e5",
    );
    const boxText = token("--vscode-button-secondaryForeground", styles.color);
    const boxBorder = token(
      "--vscode-contrastBorder",
      token("--vscode-descriptionForeground", styles.color),
    );
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        darkMode,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        primaryColor: boxFill,
        primaryTextColor: boxText,
        nodeTextColor: boxText,
        actorTextColor: boxText,
        primaryBorderColor: boxBorder,
        clusterBorder: boxBorder,
        lineColor: token("--vscode-descriptionForeground", styles.color),
        secondaryColor: styles.backgroundColor,
        tertiaryColor: styles.backgroundColor,
        textColor: styles.color,
      },
    });
    for (const node of nodes) {
      if (!node.isConnected) continue;
      node.removeAttribute("data-processed");
      node.textContent = node.dataset.source ?? "";
      try {
        await mermaid.run({ nodes: [node] });
      } catch (error) {
        showError(node, error);
      }
    }
  };
  diagramQueue = diagramQueue.then(render, render);
  return diagramQueue;
}

export function showError(
  container: HTMLElement,
  error: unknown,
  openSource?: OpenSource,
): void {
  container.classList.remove("editable");
  const message = document.createElement("pre");
  message.className = "error";
  message.setAttribute("role", "alert");
  message.textContent = error instanceof Error ? error.message : String(error);
  (container.querySelector(".spec-document") ?? container).replaceChildren(
    message,
  );
  if (openSource && !container.querySelector(".spec-toolbar")) {
    const toolbar = document.createElement("header");
    toolbar.className = "spec-toolbar";
    const button = sourceButton("Open Source", openSource, {});
    button.className = "source-button";
    toolbar.append(button);
    container.prepend(toolbar);
  }
}
