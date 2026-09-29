import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Vercel's filesystem is read-only, so without a hosted DATABASE_URL we copy
 * the bundled, seeded demo database to /tmp. Data written there is lost when
 * the instance recycles; set DATABASE_URL to a hosted database for real use.
 */
function demoDatasourceUrl(): string | undefined {
  if (!process.env.VERCEL || process.env.DATABASE_URL?.startsWith("file:/tmp") === false) return undefined;
  const target = "/tmp/quay-demo.db";
  if (!fs.existsSync(target)) fs.copyFileSync(path.join(process.cwd(), "prisma/demo.db"), target);
  return `file:${target}`;
}

// Reuse one client across hot reloads in dev.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: demoDatasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
