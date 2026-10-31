import { existsSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const figureSuffix = ".excalidraw.svg";

const figureFiles = (): Plugin => ({
  name: "native-spec:figure-files",
  apply: "serve",
  configureServer(server) {
    // Without this, the SPA fallback answers a not-yet-drawn figure with index.html.
    server.middlewares.use((request, response, next) => {
      const path = decodeURIComponent(new URL(request.url ?? "/", "http://dev").pathname);
      if (path.startsWith("/@fs/") && path.endsWith(figureSuffix) && !existsSync(path.slice("/@fs".length))) {
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
        plugins: [figureFiles()],
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
