import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Monorepo: anchor file tracing to the repo root so Next stops warning about
  // multiple lockfiles / workspace inference. `next build` runs from this
  // package dir, so the repo root is two levels up.
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
};

export default nextConfig;
