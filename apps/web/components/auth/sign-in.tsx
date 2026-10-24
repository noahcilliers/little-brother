"use client";

import dynamic from "next/dynamic";
import { GithubButtonPlaceholder } from "./github-button";

// The auth client opens a WebSocket on construction, so the live button mounts in the browser only.
export const SignIn = dynamic(() => import("./live-sign-in").then((m) => m.LiveSignIn), {
  ssr: false,
  loading: () => <GithubButtonPlaceholder />,
});
