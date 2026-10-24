"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onNew` for items that appear after the first load, so opening a page doesn't replay its history as
 * a burst of popups. `items` undefined means still loading.
 */
export function useArrivals<T>(
  items: T[] | undefined,
  key: (item: T) => string,
  onNew: (item: T) => void,
): void {
  const seen = useRef<Set<string> | null>(null);
  const handler = useRef(onNew);
  handler.current = onNew;
  const keyOf = useRef(key);
  keyOf.current = key;
  useEffect(() => {
    if (!items) return;
    if (!seen.current) {
      seen.current = new Set(items.map(keyOf.current));
      return;
    }
    for (const item of items) {
      const k = keyOf.current(item);
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      handler.current(item);
    }
  }, [items]);
}
