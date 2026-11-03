// Inlines an Excalidraw SVG so it follows the editor theme instead of its stored light palette.
import { themeColor } from "./figure-colors.js";

let figures = 0;

export function themedFigure(source: string, title: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = parsed.documentElement;
  if (svg.nodeName !== "svg" || parsed.querySelector("parsererror"))
    throw new Error("The figure file is not a valid SVG.");

  // Workspace files are untrusted markup once inlined.
  for (const element of svg.querySelectorAll("script, foreignObject, iframe, metadata"))
    element.remove();
  const elements = [svg, ...svg.querySelectorAll("*")];
  for (const element of elements)
    for (const { name, value } of [...element.attributes])
      if (/^on/i.test(name) || (/href$/i.test(name) && !value.startsWith("#") && !value.startsWith("data:")))
        element.removeAttribute(name);

  // Several figures (or the same one twice) can share a page; keep mask ids unique.
  const prefix = `figure-${++figures}-`;
  for (const element of svg.querySelectorAll("[id]")) element.id = prefix + element.id;
  for (const element of elements)
    for (const { name, value } of [...element.attributes])
      if (value.includes("url(#") || ((name === "href" || name === "xlink:href") && value.startsWith("#")))
        element.setAttribute(name, value.replaceAll("url(#", `url(#${prefix}`).replace(/^#/, `#${prefix}`));

  for (const element of svg.querySelectorAll<SVGElement>("[fill], [stroke]")) {
    if (element.closest("mask")) continue;
    for (const property of ["fill", "stroke"] as const) {
      const color = themeColor(element.getAttribute(property) ?? "");
      if (color) element.style.setProperty(property, color);
    }
  }

  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  const figure = document.importNode(svg, true) as unknown as SVGSVGElement;
  const { width, height } = figure.viewBox.baseVal;
  if (width > 0 && height > 0) {
    figure.setAttribute("width", String(width));
    figure.setAttribute("height", String(height));
    figure.style.setProperty("--figure-native-width", `${width}px`);
  }
  return figure;
}

// Arrow labels are cut out of their arrow by a mask sized when the figure was saved, which can be
// tighter than the rendered text. Refit each cut-out to the label as rendered, with breathing room.
export function fitLabelMasks(svg: SVGSVGElement): void {
  const toSvg = svg.getScreenCTM()?.inverse();
  if (!toSvg) return;
  for (const mask of svg.querySelectorAll("mask")) {
    const cutout = mask.querySelectorAll("rect")[1];
    const label = mask.nextElementSibling?.querySelector("text");
    const box = label?.getBoundingClientRect();
    if (!cutout || !box?.width) continue;
    const start = new DOMPoint(box.left, box.top).matrixTransform(toSvg);
    const end = new DOMPoint(box.right, box.bottom).matrixTransform(toSvg);
    cutout.setAttribute("x", String(start.x - 6));
    cutout.setAttribute("y", String(start.y - 2));
    cutout.setAttribute("width", String(end.x - start.x + 12));
    cutout.setAttribute("height", String(end.y - start.y + 4));
  }
}
