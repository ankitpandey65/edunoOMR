import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: [
    "canvas",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "@napi-rs/canvas-darwin-arm64",
    "@napi-rs/canvas-darwin-universal",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
