#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import project from "../definition/project.js";
import { renderHtml } from "./output/html.js";
import { renderMarkdown } from "./output/markdown.js";

const usage = `Usage: npm run specs:render -- <markdown|html> [options]

Options:
  -o, --output <path>       Write to a file instead of stdout
      --stylesheet <url>    Add a stylesheet URL to HTML output (repeatable)
  -h, --help                Show this help
`;

export async function run(args: readonly string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      output: { type: "string", short: "o" },
      stylesheet: { type: "string", multiple: true },
    },
  });

  if (values.help) {
    process.stdout.write(usage);
    return;
  }

  const [format, ...extraPositionals] = positionals;
  if ((format !== "markdown" && format !== "html") || extraPositionals.length) {
    throw new Error(usage);
  }
  if (format === "markdown" && values.stylesheet?.length) {
    throw new Error("--stylesheet is available only for HTML output.");
  }

  const output =
    format === "markdown"
      ? renderMarkdown(project)
      : renderHtml(project, { stylesheets: values.stylesheet });

  if (values.output) {
    const outputPath = resolve(values.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
    return;
  }

  process.stdout.write(output);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
