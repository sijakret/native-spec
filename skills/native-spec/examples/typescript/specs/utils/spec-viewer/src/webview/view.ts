import mermaid from "mermaid";

export async function mount(
  container: HTMLElement,
  html: string,
): Promise<void> {
  container.innerHTML = html;

  const nodes: HTMLElement[] = [];
  for (const code of container.querySelectorAll<HTMLElement>(
    "code.language-mermaid",
  )) {
    const diagram = document.createElement("div");
    diagram.className = "diagram";
    diagram.textContent = code.textContent;
    (code.parentElement ?? code).replaceWith(diagram);
    nodes.push(diagram);
  }
  if (nodes.length === 0) return;

  mermaid.initialize({
    startOnLoad: false,
    theme: document.body.classList.contains("vscode-dark") ? "dark" : "default",
  });
  await mermaid.run({ nodes });
}
