import type { CSSProperties, ReactNode } from "react";

// Device mockups for the story stage: a generic phone, a macOS-style terminal and a browser window. Neutral
// styling of our own; the "Claude" label names the app the person is using, nothing more.

type Frame = { x: number; y: number; w: number; h: number; style?: CSSProperties; children: ReactNode };

const box = ({ x, y, w, h, style }: Omit<Frame, "children">): CSSProperties => ({
  left: x,
  top: y,
  width: w,
  height: h,
  ...style,
});

export function Phone({ app, sub, ...f }: Frame & { app: string; sub: string }) {
  return (
    <div className="m-phone" style={box(f)}>
      <div className="m-phone-screen">
        <div className="m-status">
          <span>9:41</span>
          <i className="m-island" />
          <span>5G ▮▮▮</span>
        </div>
        <div className="m-appbar">
          <span className="m-glyph" aria-hidden="true" />
          <b>{app}</b>
          <small>{sub}</small>
        </div>
        <div className="m-phone-body">{f.children}</div>
      </div>
    </div>
  );
}

export function Terminal({ title, ...f }: Frame & { title: string }) {
  return (
    <div className="m-term" style={box(f)}>
      <div className="m-titlebar">
        <span className="m-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
      </div>
      <div className="m-term-body">{f.children}</div>
    </div>
  );
}

export function Browser({ url, ...f }: Frame & { url: string }) {
  return (
    <div className="m-browser" style={box(f)}>
      <div className="m-titlebar">
        <span className="m-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="m-url">{url}</span>
      </div>
      <div className="m-browser-body">{f.children}</div>
    </div>
  );
}

/** The presenter's pointer; `press` shrinks it for a click. */
export function Pointer({ x, y, press, shown }: { x: number; y: number; press: boolean; shown: boolean }) {
  return (
    <span
      className="m-pointer"
      style={{ transform: `translate(${x}px, ${y}px) scale(${press ? 0.8 : 1})`, opacity: shown ? 1 : 0 }}
    >
      <svg viewBox="0 0 18 22" aria-hidden="true">
        <path d="M1 1 L1 17 L5.5 13 L8.5 20 L11 19 L8 12 L14 12 Z" />
      </svg>
    </span>
  );
}

/** A finger tap on a phone: a ring that expands and fades. */
export function Tap({ x, y, p }: { x: number; y: number; p: number }) {
  if (p <= 0 || p >= 1) return null;
  return <span className="m-tap" style={{ left: x, top: y, transform: `scale(${0.4 + p})`, opacity: 1 - p }} />;
}
