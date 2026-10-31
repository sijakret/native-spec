import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { DOMParser } from "@xmldom/xmldom";
import {
  isFigure,
  type ArchitectureBlock,
  type Figure,
  type SpecProject,
} from "../definition/process.js";

interface SceneElement {
  readonly id: string;
  readonly type: string;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
  readonly isDeleted?: boolean;
  readonly containerId?: string;
  readonly text?: string;
  readonly boundElements?: readonly {
    readonly id: string;
    readonly type: string;
  }[];
  readonly customData?: {
    readonly nativeSpec?: {
      readonly project: string;
      readonly kind: string;
      readonly id: string;
    };
  };
}

export function auditExcalidraw(
  source: string,
  required: readonly ArchitectureBlock[],
  allowed: readonly ArchitectureBlock[] = required,
): readonly string[] {
  try {
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    if (document.documentElement?.localName !== "svg")
      throw new Error("Expected an SVG document.");
    const metadata = document.getElementsByTagName("metadata")[0];
    if (!metadata) throw new Error("Missing editable Excalidraw scene.");
    const nodes = Array.from(metadata.childNodes);
    const start = nodes.findIndex(
      (node) =>
        node.nodeType === 8 && node.nodeValue?.trim() === "payload-start",
    );
    const end = nodes.findIndex(
      (node) => node.nodeType === 8 && node.nodeValue?.trim() === "payload-end",
    );
    if (start < 0 || end <= start)
      throw new Error("Missing editable Excalidraw scene.");
    const encoded = nodes
      .slice(start + 1, end)
      .map((node) => node.nodeValue ?? "")
      .join("")
      .trim();
    const payload = JSON.parse(
      Buffer.from(encoded, "base64").toString("latin1"),
    );
    if (payload.encoding !== "bstring")
      throw new Error("Unsupported Excalidraw payload encoding.");
    const bytes = Buffer.from(payload.encoded, "latin1");
    const scene = JSON.parse(
      (payload.compressed
        ? inflateSync(bytes, { maxOutputLength: 5_000_000 })
        : bytes
      ).toString("utf8"),
    );
    if (scene.type !== "excalidraw" || !Array.isArray(scene.elements))
      throw new Error("Invalid Excalidraw scene.");
    const elements: readonly SceneElement[] = scene.elements;
    const visible = (element: SceneElement) =>
      !element.isDeleted &&
      element.opacity > 0 &&
      element.width > 0 &&
      element.height > 0;
    const text = Array.from(
      document.getElementsByTagNameNS("http://www.w3.org/2000/svg", "text"),
    )
      .filter((element) => {
        for (
          let ancestor = element;
          ancestor;
          ancestor = ancestor.parentElement!
        ) {
          if (
            ancestor.getAttribute("display") === "none" ||
            ancestor.getAttribute("visibility") === "hidden" ||
            ancestor.getAttribute("opacity") === "0"
          )
            return false;
          if (
            /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$))/.test(
              ancestor.getAttribute("style") ?? "",
            )
          )
            return false;
        }
        return true;
      })
      .map((element) => element.textContent ?? "");
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const element of elements.filter(
      (element) =>
        visible(element) &&
        element.customData?.nativeSpec?.kind === "architecture-block",
    )) {
      const reference = element.customData!.nativeSpec!;
      const block = allowed.find(
        (block) =>
          block.id === reference.id && block.project === reference.project,
      );
      if (!block)
        problems.push(
          `Unknown Excalidraw ABB node: ${reference.project}:${reference.id}`,
        );
      if (seen.has(reference.id))
        problems.push(`Duplicate Excalidraw ABB node: ${reference.id}`);
      const label = elements.find(
        (candidate) =>
          visible(candidate) &&
          candidate.type === "text" &&
          candidate.containerId === element.id &&
          element.boundElements?.some(
            (bound) => bound.type === "text" && bound.id === candidate.id,
          ) &&
          candidate.text?.split(/\s+/).includes(reference.id),
      );
      if (
        !label ||
        !["rectangle", "ellipse", "diamond"].includes(element.type) ||
        !text.some((value) => value.split(/\s+/).includes(reference.id))
      )
        problems.push(
          `Excalidraw ABB node must have a visible bound label: ${reference.id}`,
        );
      else seen.add(reference.id);
    }
    for (const block of required)
      if (!seen.has(block.id))
        problems.push(`Missing Excalidraw ABB node: ${block.id}`);
    return problems;
  } catch (error) {
    return [
      `Invalid Excalidraw figure: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
}

export function validateArchitectureFigures(
  project: SpecProject,
): readonly string[] {
  const blocks = project.artifacts.filter(
    (artifact) => artifact.kind === "architecture-block",
  );
  const problems: string[] = [];
  const check = (figure: Figure, required: readonly ArchitectureBlock[]) => {
    try {
      for (const problem of auditExcalidraw(
        readFileSync(new URL(figure.excalidraw), "utf8"),
        required,
        blocks,
      ))
        problems.push(`${figure.title}: ${problem}`);
    } catch (error) {
      problems.push(
        `${figure.title}: Cannot read Excalidraw figure: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  for (const diagram of project.overview?.diagrams ?? [])
    if (isFigure(diagram) && "blocks" in diagram) check(diagram, blocks);
  for (const block of blocks)
    if (block.summaryDiagram && isFigure(block.summaryDiagram))
      check(block.summaryDiagram, [block]);
  return problems;
}
