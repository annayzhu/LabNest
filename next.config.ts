import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.0.102"],
  experimental: {
    serverActions: {
      // The Sequence import UI accepts files up to 25 MiB. Leave room for the
      // multipart envelope while preserving the application-level 25 MiB cap.
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
