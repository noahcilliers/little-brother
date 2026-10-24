"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type Props = { className: string; children: ReactNode; as?: "div" | "article" };

/**
 * Marks its subtree `data-play="on"` only while it is on screen. The loops are pure CSS, so pausing them
 * off-screen is what keeps a page of seven looping scenes from burning a laptop's battery.
 */
export function PlayOnView({ className, children, as = "div" }: Props) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setOn(entries.some((e) => e.isIntersecting)), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={className} data-play={on ? "on" : "off"}>
      {children}
    </Tag>
  );
}
