// WCAG 2.x relative luminance and contrast ratio. Shared by the design-system reference page and
// tests/design-tokens.test.mjs so both use the same arithmetic. Accepts #rgb, #rrggbb or "rgb(r, g, b)".
export function parseColor(value) {
  const text = String(value).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/i.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`Unsupported colour value: ${value}`);
}

export function relativeLuminance(value) {
  const [r, g, b] = parseColor(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WCAG_TEXT_AA = 4.5; // normal text
export const WCAG_LARGE_TEXT_AA = 3; // >= 24px, or >= 18.66px bold
export const WCAG_NON_TEXT_AA = 3; // control boundaries, focus indicators, status graphics
