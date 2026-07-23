import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Playwright는 번들링하지 않고 런타임에 그대로 require 합니다
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
