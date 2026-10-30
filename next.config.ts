import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // There is an unrelated package-lock.json in the home folder; tell Next.js
  // this folder is the project root so it doesn't guess wrong.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
