import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DevTools / build indicator yalnızca development'ta; production build'de görünmez.
  devIndicators: false,
};

export default nextConfig;
