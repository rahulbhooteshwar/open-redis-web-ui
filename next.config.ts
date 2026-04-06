import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["rawproto"],
  serverExternalPackages: [
    "ioredis",
    "tunnel-ssh",
    "ssh2",
    "write-file-atomic",
    "ws",
  ],
  // Monaco editor workers need to be treated as external assets
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Monaco editor — workers are served from the client as static files
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
