// DOM-free so the spec tests can check the palette mapping.

// Excalidraw's palette mapped onto theme tokens: ink and greys follow foreground/muted/background,
// colored strokes use the chart colors, and pastel fills mix a chart color into the background.
export function themeColor(value: string): string | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())?.[1];
  if (!hex) return undefined;
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.15 || delta < 0.08) {
    if (lightness < 0.2) return "var(--spec-foreground)";
    if (lightness > 0.9) return "var(--spec-background)";
    return "var(--spec-muted)";
  }
  const hue =
    max === r ? (60 * ((g - b) / delta) + 360) % 360
    : max === g ? 60 * ((b - r) / delta) + 120
    : 60 * ((r - g) / delta) + 240;
  const chart =
    hue < 15 || hue >= 345 ? "red"
    : hue < 40 ? "orange"
    : hue < 70 ? "yellow"
    : hue < 170 ? "green"
    : hue < 260 ? "blue"
    : "purple";
  const token = `var(--vscode-charts-${chart}, #${full})`;
  return lightness > 0.7
    ? `color-mix(in srgb, ${token} 30%, var(--spec-background))`
    : token;
}
