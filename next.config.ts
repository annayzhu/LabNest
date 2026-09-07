import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:"/tools/calculator/worker.js",headers:[{key:"Service-Worker-Allowed",value:"/"}]}];},
  distDir: process.env.LABNEST_BUILD_DIR || ".next",
  typescript: { tsconfigPath: process.env.LABNEST_TSCONFIG_PATH || "tsconfig.json" },
  allowedDevOrigins: ["127.0.0.1", "192.168.0.101", "192.168.0.102"],
  experimental: {
    serverActions: {
      // The Sequence import UI accepts files up to 25 MiB. Leave room for the
      // multipart envelope while preserving the application-level 25 MiB cap.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
