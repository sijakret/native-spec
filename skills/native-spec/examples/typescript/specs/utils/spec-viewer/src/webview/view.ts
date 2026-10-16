import mermaid from "mermaid";

const observed = new WeakSet<HTMLElement>();
let diagramQueue = Promise.resolve();

export async function mount(
  container: HTMLElement,
  html: string,
): Promise<void> {
  const collapsedGroups = new Set(
    Array.from(
      container.querySelectorAll("details.spec-nav-group:not([open]) summary"),
      (summary) => summary.getAttribute("title"),
    ),
  );
  container.classList.remove("editable");
  container.innerHTML = html;
  for (const group of container.querySelectorAll<HTMLDetailsElement>(
    ".spec-nav-group",
  )) {
    if (
      collapsedGroups.has(
        group.querySelector("summary")?.getAttribute("title") ?? null,
      )
    )
      group.open = false;
  }

  const toggle = container.querySelector<HTMLButtonElement>(
    "[data-toggle-navigation]",
  );
  const navigation = container.querySelector<HTMLElement>("#spec-navigation");
  const panel = container.querySelector<HTMLElement>(".spec-panel");
  if (toggle && navigation && panel) {
    const setCollapsed = (collapsed: boolean): void => {
      container.dataset.navigationCollapsed = String(collapsed);
      navigation.hidden = collapsed;
      panel.classList.toggle("navigation-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
    };
    setCollapsed(
      container.dataset.navigationCollapsed === undefined
        ? matchMedia("(max-width: 700px)").matches
        : container.dataset.navigationCollapsed === "true",
    );
    toggle.addEventListener("click", () => setCollapsed(!navigation.hidden));
    navigation.addEventListener("click", (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("a") &&
        matchMedia("(max-width: 700px)").matches
      )
        setCollapsed(true);
    });
  }

  for (const code of container.querySelectorAll<HTMLElement>(
    "code.language-mermaid",
  )) {
    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.dataset.source = code.textContent;
    (code.parentElement ?? code).replaceWith(diagram);
  }
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
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refresh);
  }
  await renderDiagrams(container);
}

function renderDiagrams(container: HTMLElement): Promise<void> {
  const render = async (): Promise<void> => {
    const nodes = container.querySelectorAll<HTMLElement>(".diagram[data-source]");
    if (nodes.length === 0) return;
    const styles = getComputedStyle(document.body);
    const token = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: {
        darkMode:
          styles.colorScheme === "dark" ||
          (styles.colorScheme === "light dark" &&
            matchMedia("(prefers-color-scheme: dark)").matches),
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        primaryColor: token("--vscode-sideBar-background", styles.backgroundColor),
        primaryTextColor: styles.color,
        primaryBorderColor: token(
          "--vscode-contrastBorder",
          token("--vscode-panel-border", styles.color),
        ),
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

export function showError(container: HTMLElement, error: unknown): void {
  container.classList.remove("editable");
  const message = document.createElement("pre");
  message.className = "error";
  message.setAttribute("role", "alert");
  message.textContent = error instanceof Error ? error.message : String(error);
  (container.querySelector(".spec-document") ?? container).replaceChildren(
    message,
  );
}
