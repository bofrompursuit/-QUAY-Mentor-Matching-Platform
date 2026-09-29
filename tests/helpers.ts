import { prisma } from "@/lib/db";

export async function resetDb() {
  await prisma.freshnessFlag.deleteMany();
  await prisma.mentorRequest.deleteMany();
  await prisma.session.deleteMany();
  await prisma.startup.deleteMany();
  await prisma.mentor.deleteMany();
}

let n = 0;
export function mentorData(over: Record<string, unknown> = {}) {
  n++;
  return { name: `Mentor ${n}`, email: `m${n}-${Date.now()}@example.com`, expertise: "fundraising", ...over };
}

export const DAY = 24 * 60 * 60 * 1000;
