"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

const QUIET = 2;

/** A QR code as one SVG path in the current text color, so it follows the theme and stays crisp on a projector. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, d } = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
    let path = "";
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++)
        if (modules.get(x, y)) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    return { size: modules.size + QUIET * 2, d: path };
  }, [text]);
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      <rect className="qr-bg" width={size} height={size} />
      <path d={d} fill="currentColor" />
    </svg>
  );
}
