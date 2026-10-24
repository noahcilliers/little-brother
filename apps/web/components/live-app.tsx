"use client";

import { Board } from "./board/board";
import { Providers } from "./providers";

export function LiveApp() {
  return (
    <Providers>
      <Board />
    </Providers>
  );
}
