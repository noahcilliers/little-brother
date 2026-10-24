"use client";

import { useState } from "react";
import { errorText } from "./error-text";

/** Busy and error state around one mutation call, so every form reports failures the same way. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T>(p: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await p();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
