import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import type * as CodeAudit from "../../audit/code-audit.js";
import type project from "../../definition/project.js";

const figureSuffix = ".excalidraw.svg";
const specs = fileURLToPath(new URL("../../", import.meta.url));

const codeLinks = (): Plugin => ({
  name: "native-spec:code-links",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(
      "/__native-spec/trace-links",
      async (_request, response) => {
        try {
          const audit = (await server.ssrLoadModule(
            join(specs, "audit/code-audit.ts"),
          )) as typeof CodeAudit;
          const model = (await server.ssrLoadModule(
            join(specs, "definition/project.ts"),
          )) as { default: typeof project };
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(
            JSON.stringify(audit.readTraceLinks(specs, model.default)),
          );
        } catch (error) {
          response.statusCode = 500;
          response.end(error instanceof Error ? error.message : String(error));
        }
      },
    );
  },
});

const figureFiles = (): Plugin => ({
  name: "native-spec:figure-files",
  apply: "serve",
  configureServer(server) {
    // Without this, the SPA fallback answers a not-yet-drawn figure with index.html.
    server.middlewares.use((request, response, next) => {
      const path = decodeURIComponent(
        new URL(request.url ?? "/", "http://dev").pathname,
      );
      if (
        path.startsWith("/@fs/") &&
        path.endsWith(figureSuffix) &&
        !existsSync(path.slice("/@fs".length))
      ) {
        response.statusCode = 404;
        response.end();
        return;
      }
      next();
    });
  },
});

// `vite build --mode extension` bundles the host; the default build bundles the webview.
export default defineConfig(({ mode }) =>
  mode === "extension"
    ? {
        build: {
          outDir: "dist",
          target: "node22",
          minify: false,
          lib: {
            entry: "src/extension.ts",
            formats: ["cjs"],
            fileName: () => "extension.cjs",
          },
          rollupOptions: { external: ["vscode", /^node:/] },
        },
      }
    : {
        // The dev page imports the spec graph two folders up.
        server: { fs: { allow: ["../.."] } },
        // Library mode leaves `process.env` references in browser dependencies.
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        plugins: [figureFiles(), codeLinks()],
        build: {
          outDir: "dist/webview",
          lib: {
            entry: "src/webview/main.ts",
            formats: ["es"],
            fileName: () => "main.js",
            cssFileName: "style",
          },
        },
      },
);
