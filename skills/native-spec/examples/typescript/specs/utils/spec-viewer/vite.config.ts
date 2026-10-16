import { defineConfig } from "vite";

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
