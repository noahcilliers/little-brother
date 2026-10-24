import type { NextConfig } from "next";

export const config: NextConfig = {
  transpilePackages: ["@lb/backend", "@lb/core"],
  reactStrictMode: true,
};

export default config;
