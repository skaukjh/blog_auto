import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // data/blog-style.txt 는 런타임에 fs로 읽으므로 자동 추적이 되지 않습니다.
  // 배포 번들에 포함되도록 명시합니다.
  outputFileTracingIncludes: {
    "/api/blog/**": ["./data/**"],
  },
};

export default nextConfig;
