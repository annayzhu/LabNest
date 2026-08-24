import type { NextConfig } from "next";

function deploymentBasePath(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") return "";
  const normalized = `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
  if (!/^\/[A-Za-z0-9._~/-]+$/.test(normalized) || normalized.includes("..")) {
    throw new Error("NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH must be a simple URL path such as /visualization-studio.");
  }
  return normalized;
}

const basePath = deploymentBasePath(process.env.NEXT_PUBLIC_VISUALIZATION_STUDIO_BASE_PATH);

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
