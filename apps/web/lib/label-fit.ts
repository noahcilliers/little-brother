// Labels on the graph are SVG text at fixed font sizes; these widths are the average glyph advance per font.
export const CHAR_W = { bar: 6.4, below: 5.8, pill: 6.1, band: 6.6 } as const;

/**
 * Where a label starts so it stays readable when its mark begins left of the visible area: at the mark, or
 * pinned to the viewport's left edge while the mark runs underneath it.
 */
export function stickyX(markX: number, viewLeft: number, pad: number): number {
  return Math.max(markX + pad, viewLeft + pad);
}

/** The text cut to fit `room` pixels, with an ellipsis; empty when not even two characters fit. */
export function fitText(text: string, room: number, charW: number): string {
  const n = Math.floor(room / charW);
  if (n >= text.length) return text;
  if (n < 2) return "";
  return `${text.slice(0, n - 1)}…`;
}
