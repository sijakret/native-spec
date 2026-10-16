import { mount } from "./view.js";
import "./styles.css";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type HostMessage =
  | {
      readonly type: "render";
      readonly html: string;
      readonly editable: boolean;
    }
  | { readonly type: "error"; readonly message: string };

const vscode = acquireVsCodeApi();
const app = document.getElementById("app")!;

window.addEventListener("message", (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  if (message.type === "render") {
    void mount(app, message.html).then(() => {
      if (message.editable) enableEditing(app);
    });
    return;
  }
  const error = document.createElement("pre");
  error.className = "error";
  error.textContent = message.message;
  app.replaceChildren(error);
});

function enableEditing(container: HTMLElement): void {
  container.classList.add("editable");
  for (const field of container.querySelectorAll<HTMLElement>("[data-path]")) {
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
    path: path
      .split(".")
      .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment)),
    value,
  });
}

document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  if (!link) return;
  event.preventDefault();
  vscode.postMessage({
    type: "open",
    anchor: link.getAttribute("href")!.slice(1),
  });
});

vscode.postMessage({ type: "ready" });
