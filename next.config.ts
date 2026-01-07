import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@nutrient-sdk/node"],
  turbopack: {},
};

export default nextConfig;
