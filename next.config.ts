import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the seeded demo database with every server function (see src/lib/db.ts).
  outputFileTracingIncludes: { "/**": ["./prisma/demo.db"] },
};

export default nextConfig;
