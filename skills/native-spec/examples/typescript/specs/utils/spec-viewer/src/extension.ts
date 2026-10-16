import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { createInterface } from "node:readline";
import type * as TS from "typescript";
import * as vscode from "vscode";
import { editArtifactSource, type PathSegment } from "./edits.js";
import { findSpecsDirectory } from "./project.js";

const viewType = "nativeSpec.artifact";
const artifactFilename = /\.(?:abb|mr|sr|nfr|tc|risk|sprint)\.ts$/;

interface RenderResult {
  readonly html: string;
  readonly locations: Record<string, string>;
}

type WebviewMessage =
  | { readonly type: "ready" }
  | { readonly type: "open"; readonly anchor: string }
  | {
      readonly type: "edit";
      readonly path: readonly PathSegment[];
      readonly value: string | boolean;
    };

export function activate(context: vscode.ExtensionContext): void {
  const renderers = new Map<string, Renderer>();
  const rendererFor = (specs: string): Renderer => {
    let renderer = renderers.get(specs);
    if (!renderer) {
      renderer = new Renderer(specs, context.extensionPath);
      renderers.set(specs, renderer);
    }
    return renderer;
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("nativeSpec.openOverview", async () => {
      const projects = await vscode.workspace.findFiles(
        "**/definition/project.ts",
        "**/{node_modules,dist}/**",
      );
      const items = projects.map((uri) => {
        const directory = vscode.Uri.joinPath(uri, "..", "..");
        return {
          label: vscode.workspace.asRelativePath(directory),
          uri: vscode.Uri.joinPath(directory, "artifacts", "index.ts"),
        };
      });
      if (items.length === 0) {
        void vscode.window.showErrorMessage(
          "No Native Spec project found. Open a workspace containing definition/project.ts.",
        );
        return;
      }
      const selected =
        items.length === 1
          ? items[0]
          : await vscode.window.showQuickPick(items, {
              placeHolder: "Choose a specification",
            });
      if (selected)
        await vscode.commands.executeCommand(
          "vscode.openWith",
          selected.uri,
          viewType,
        );
    }),
    vscode.window.registerCustomEditorProvider(
      viewType,
      new ArtifactEditorProvider(context, rendererFor),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      },
    ),
    new vscode.Disposable(() => {
      for (const renderer of renderers.values()) renderer.dispose();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("nativeSpec")) return;
      for (const renderer of renderers.values()) renderer.reset();
    }),
  );
}

// One tsx worker per spec project; the graph stays warm between renders.
class Renderer {
  private child: ChildProcess | undefined;
  private nextId = 0;
  private readonly pending = new Map<
    number,
    { resolve(result: RenderResult): void; reject(error: Error): void }
  >();

  constructor(
    private readonly specs: string,
    private readonly extensionPath: string,
  ) {}

  render(document: vscode.TextDocument): Promise<RenderResult> {
    const child = this.child ?? this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      child.stdin!.write(
        `${JSON.stringify({ id, path: document.uri.path, source: document.getText() })}\n`,
      );
    });
  }

  // Called when any spec file changes: the next render boots a fresh graph.
  reset(): void {
    this.child?.kill();
    this.child = undefined;
  }

  dispose(): void {
    this.reset();
  }

  private start(): ChildProcess {
    const tsx = workspaceRequire(this.specs).resolve("tsx/cli");
    const child = spawn(
      process.execPath,
      [tsx, join(this.extensionPath, "src", "render.ts"), this.specs],
      {
        cwd: this.specs,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.child = child;
    let stderr = "";
    child.stderr!.on("data", (chunk) => (stderr += chunk));
    createInterface({ input: child.stdout! }).on("line", (line) => {
      const message = JSON.parse(line) as
        | ({ id: number } & RenderResult)
        | { id: number; error: string };
      const request = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (!request) return;
      if ("error" in message) request.reject(new Error(message.error));
      else request.resolve(message);
    });
    child.on("close", (code) => {
      if (this.child === child) this.child = undefined;
      const error = new Error(
        stderr.trim() || `Renderer exited with code ${code ?? "unknown"}.`,
      );
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
    child.on("error", (error) => {
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
    return child;
  }
}

class ArtifactEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly rendererFor: (specs: string) => Renderer,
  ) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
  ): Promise<void> {
    const distUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview",
    );
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [distUri],
    };
    panel.webview.html = shell(panel.webview, distUri);

    const root = workspaceRoot(document.uri);
    const configured = vscode.workspace
      .getConfiguration("nativeSpec", document.uri)
      .get<string>("specsFolder", "specs");
    const specs = findSpecsDirectory(root, document.uri.fsPath, configured);
    const renderer = this.rendererFor(specs);
    // Index modules re-export several artifacts and are browse-only.
    const editable =
      document.uri.scheme === "file" &&
      artifactFilename.test(document.uri.path);
    let locations: Record<string, string> = {};

    const render = async (): Promise<void> => {
      try {
        const result = await renderer.render(document);
        locations = result.locations;
        await panel.webview.postMessage({
          type: "render",
          html: result.html,
          editable,
        });
      } catch (error) {
        await panel.webview.postMessage({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      clearTimeout(timer);
      timer = setTimeout(render, 150);
    };

    const watchPattern = relative(root, specs);
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        root,
        watchPattern ? `${watchPattern}/**/*.ts` : "**/*.ts",
      ),
    );
    const resetAndSchedule = (): void => {
      renderer.reset();
      schedule();
    };
    const disposables: vscode.Disposable[] = [
      watcher,
      watcher.onDidChange(resetAndSchedule),
      watcher.onDidCreate(resetAndSchedule),
      watcher.onDidDelete(resetAndSchedule),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString())
          schedule();
      }),
      panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
        if (message.type === "ready") await render();
        if (message.type === "open") {
          const file = locations[message.anchor];
          if (file) {
            await vscode.commands.executeCommand(
              "vscode.openWith",
              vscode.Uri.file(file),
              viewType,
            );
          } else {
            void vscode.window.showErrorMessage(
              `No source file found for spec link: ${message.anchor}`,
            );
          }
        }
        if (message.type === "edit" && editable) {
          try {
            await applyEdit(specs, document, message.path, message.value);
          } catch (error) {
            void vscode.window.showErrorMessage(
              error instanceof Error ? error.message : String(error),
            );
            schedule();
          }
        }
      }),
    ];
    panel.onDidDispose(() => {
      clearTimeout(timer);
      for (const disposable of disposables) disposable.dispose();
    });
  }
}

function workspaceRoot(uri: vscode.Uri): string {
  // git: and other diff-side schemes keep the file path, so match on path only.
  const folder = vscode.workspace.workspaceFolders?.find((candidate) =>
    uri.path.startsWith(`${candidate.uri.path}/`),
  );
  if (!folder) throw new Error("Open the artifact inside its workspace.");
  return folder.uri.fsPath;
}

function workspaceRequire(root: string): NodeJS.Require {
  return createRequire(join(root, "package.json"));
}

async function applyEdit(
  specs: string,
  document: vscode.TextDocument,
  path: readonly PathSegment[],
  value: string | boolean,
): Promise<void> {
  const ts = workspaceRequire(specs)("typescript") as typeof TS;
  const change = editArtifactSource(ts, document.getText(), path, value);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      document.positionAt(change.start),
      document.positionAt(change.end),
    ),
    change.text,
  );
  if (!(await vscode.workspace.applyEdit(edit))) {
    throw new Error("The edit could not be applied.");
  }
  await formatDocument(document);
}

async function formatDocument(document: vscode.TextDocument): Promise<void> {
  // Best effort: keeps formatter-checked sources tidy when a formatter is installed.
  const edits = await vscode.commands.executeCommand<
    vscode.TextEdit[] | undefined
  >("vscode.executeFormatDocumentProvider", document.uri, {
    tabSize: 2,
    insertSpaces: true,
  });
  if (!edits?.length) return;
  const edit = new vscode.WorkspaceEdit();
  edit.set(document.uri, edits);
  await vscode.workspace.applyEdit(edit);
}

function shell(webview: vscode.Webview, distUri: vscode.Uri): string {
  const script = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "main.js"));
  const style = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "style.css"));
  const nonce = randomUUID().replaceAll("-", "");
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <link rel="stylesheet" href="${style}">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${script}"></script>
  </body>
</html>`;
}
