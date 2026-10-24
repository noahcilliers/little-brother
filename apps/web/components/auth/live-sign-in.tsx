"use client";

import { Providers } from "../providers";
import { GithubButton } from "./github-button";

export function LiveSignIn(props: { redirectTo: string; disabled?: boolean }) {
  return (
    <Providers>
      <GithubButton {...props} />
    </Providers>
  );
}
