import {
  mount,
  showError,
  type FigureHost,
  type SourceTarget,
} from "./view.js";
import { parseFieldPath } from "../edits.js";
import "./styles.css";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

// Sidecar file URLs under `from` are served to the webview under `to`.
interface FigureMapping {
  readonly from: string;
  readonly to: string;
  readonly revision: number;
}

type ViewMessage =
  | {
      readonly type: "render";
      readonly html: string;
      readonly editable: boolean;
      readonly figures: FigureMapping;
    }
  | { readonly type: "error"; readonly message: string };

const vscode = acquireVsCodeApi();
const app = document.getElementById("app")!;
const openSource = (target: SourceTarget): void =>
  vscode.postMessage({ type: "source", ...target });
let revision = 0;

const figureHost = ({ from, to, revision }: FigureMapping): FigureHost => ({
  href: (url) =>
    url.startsWith(from) ? `${to}${url.slice(from.length)}?v=${revision}` : url,
});

window.addEventListener("message", (event: MessageEvent<ViewMessage>) => {
  handle(event.data);
});

function handle(message: ViewMessage): void {
  const current = ++revision;
  if (message.type === "render") {
    void mount(app, message.html, openSource, figureHost(message.figures))
      .then(() => {
        if (current === revision && message.editable) enableEditing(app);
      })
      .catch((error: unknown) => {
        if (current === revision) showError(app, error, openSource);
      });
    return;
  }
  showError(app, message.message, openSource);
}

function enableEditing(container: HTMLElement): void {
  container.classList.add("editable");
  for (const field of container.querySelectorAll<HTMLElement>(
    ".spec-content article [data-path]",
  )) {
    if (field instanceof HTMLInputElement) {
      field.disabled = false;
      field.addEventListener("change", () =>
        postEdit(field.dataset.path!, field.checked),
      );
      continue;
    }
    field.contentEditable = "plaintext-only";
    const original = field.textContent;
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        field.blur();
      }
      if (event.key === "Escape") {
        field.textContent = original;
        field.blur();
      }
    });
    field.addEventListener("blur", () => {
      const value = field.textContent.trim();
      if (value && value !== original) postEdit(field.dataset.path!, value);
      else field.textContent = original;
    });
  }
}

function postEdit(path: string, value: string | boolean): void {
  vscode.postMessage({
    type: "edit",
    path: parseFieldPath(path),
    value,
  });
}

document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  if (!link) return;
  const anchor = link.getAttribute("href")!.slice(1);
  if (anchor === "spec-content") return;
  event.preventDefault();
  vscode.postMessage({
    type: "open",
    anchor,
  });
});

vscode.postMessage({ type: "ready" });
