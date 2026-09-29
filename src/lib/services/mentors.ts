import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { describeRole, detectRoleChange, isStale, staleAfterDays } from "../freshness";
import { mentorInput, mentorUpdate, type MentorInput, type MentorUpdate } from "../validation";

export type MentorSource = "MANUAL" | "SLACK" | "IMPORT";
export type FlagSource = "MANUAL" | "SLACK" | "IMPORT" | "WEBHOOK" | "SYSTEM";

export interface MentorFilter {
  q?: string;
  tag?: string;
  active?: boolean;
  stale?: boolean;
}

export async function listMentors(filter: MentorFilter = {}, now = new Date()) {
  const where: Prisma.MentorWhereInput = {};
  if (filter.active !== undefined) where.active = filter.active;
  if (filter.tag) where.expertise = { contains: filter.tag.toLowerCase() };
  if (filter.q) {
    const q = filter.q.trim();
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q.toLowerCase() } },
      { company: { contains: q } },
      { title: { contains: q } },
      { expertise: { contains: q.toLowerCase() } },
    ];
  }
  if (filter.stale !== undefined) {
    const cutoff = new Date(now.getTime() - staleAfterDays() * 24 * 60 * 60 * 1000);
    where.lastVerifiedAt = filter.stale ? { lte: cutoff } : { gt: cutoff };
  }
  const mentors = await prisma.mentor.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { flags: { where: { status: "OPEN" } }, sessions: true, requests: true } } },
  });
  return mentors.map((m) => ({ ...m, stale: isStale(m.lastVerifiedAt, now) }));
}

export async function getMentor(id: string) {
  const mentor = await prisma.mentor.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { scheduledAt: "desc" } },
      requests: { orderBy: { createdAt: "desc" }, include: { startup: true } },
      flags: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!mentor) throw new NotFoundError("Mentor");
  return mentor;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function createMentor(input: MentorInput, source: MentorSource = "MANUAL") {
  const data = mentorInput.parse(input);
  try {
    return await prisma.mentor.create({ data: { ...data, source } });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError(`A mentor with email ${data.email} already exists`);
    throw err;
  }
}

/**
 * Updates a mentor from a trusted source (admin form or teammate via Slack).
 * Trusted edits count as verification. A role change is logged as a resolved
 * JOB_CHANGE flag so the history stays auditable.
 */
export async function updateMentor(id: string, input: MentorUpdate, source: FlagSource = "MANUAL") {
  const data = mentorUpdate.parse(input);
  const current = await prisma.mentor.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Mentor");

  const roleChanged = detectRoleChange(current, { title: data.title, company: data.company });
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const mentor = await tx.mentor.update({ where: { id }, data: { ...data, lastVerifiedAt: now } });
      if (roleChanged) {
        await tx.freshnessFlag.create({
          data: {
            mentorId: id,
            reason: "JOB_CHANGE",
            source,
            status: "RESOLVED",
            resolvedAt: now,
            details: JSON.stringify({
              from: { title: current.title, company: current.company },
              to: { title: mentor.title, company: mentor.company },
            }),
          },
        });
      }
      // A trusted edit supersedes open staleness / job-change alerts.
      await tx.freshnessFlag.updateMany({
        where: { mentorId: id, status: "OPEN", reason: { in: roleChanged ? ["STALE", "JOB_CHANGE"] : ["STALE"] } },
        data: { status: "RESOLVED", resolvedAt: now },
      });
      return mentor;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError(`A mentor with email ${data.email} already exists`);
    throw err;
  }
}

/** Creates the mentor, or updates the existing record with the same email. */
export async function upsertMentorByEmail(input: MentorInput, source: "SLACK" | "IMPORT") {
  const data = mentorInput.parse(input);
  const existing = await prisma.mentor.findUnique({ where: { email: data.email } });
  if (!existing) return { mentor: await createMentor(data, source), created: true };
  // Only overwrite fields the teammate actually supplied.
  const patch = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as MentorUpdate;
  return { mentor: await updateMentor(existing.id, patch, source), created: false };
}

export async function deleteMentor(id: string) {
  try {
    await prisma.mentor.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") throw new NotFoundError("Mentor");
    throw err;
  }
}

export async function verifyMentor(id: string) {
  const now = new Date();
  const mentor = await prisma.mentor.findUnique({ where: { id } });
  if (!mentor) throw new NotFoundError("Mentor");
  await prisma.freshnessFlag.updateMany({
    where: { mentorId: id, status: "OPEN", reason: "STALE" },
    data: { status: "RESOLVED", resolvedAt: now },
  });
  return prisma.mentor.update({ where: { id }, data: { lastVerifiedAt: now } });
}

export async function flagMentor(
  mentorId: string,
  reason: "JOB_CHANGE" | "STALE" | "BOUNCED_EMAIL" | "OTHER",
  source: FlagSource,
  details?: string,
) {
  const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
  if (!mentor) throw new NotFoundError("Mentor");
  return prisma.freshnessFlag.create({ data: { mentorId, reason, source, details } });
}

export interface ProposedRoleChange {
  from: { title?: string | null; company?: string | null };
  to: { title?: string | null; company?: string | null };
}

export function parseRoleChange(details?: string | null): ProposedRoleChange | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    return parsed?.to ? parsed : null;
  } catch {
    return null;
  }
}

export function describeFlag(flag: { reason: string; details: string | null }): string {
  const change = parseRoleChange(flag.details);
  if (change) return `${describeRole(change.from)} → ${describeRole(change.to)}`;
  return flag.details ?? flag.reason.replace("_", " ").toLowerCase();
}

/**
 * Records a role change reported by an external, unverified source (an
 * enrichment provider webhook). The mentor record is left untouched until an
 * admin applies the proposed change.
 */
export async function reportRoleChange(
  email: string,
  incoming: { title?: string | null; company?: string | null },
  source: FlagSource = "WEBHOOK",
) {
  const mentor = await prisma.mentor.findUnique({ where: { email: email.toLowerCase() } });
  if (!mentor) throw new NotFoundError("Mentor");
  if (!detectRoleChange(mentor, incoming)) return { flagged: false as const };

  const details = JSON.stringify({
    from: { title: mentor.title, company: mentor.company },
    to: { title: incoming.title || mentor.title, company: incoming.company || mentor.company },
  });
  // Avoid piling up duplicates when a provider re-sends the same event.
  const duplicate = await prisma.freshnessFlag.findFirst({
    where: { mentorId: mentor.id, reason: "JOB_CHANGE", status: "OPEN", details },
  });
  if (duplicate) return { flagged: true as const, flag: duplicate };
  const flag = await prisma.freshnessFlag.create({
    data: { mentorId: mentor.id, reason: "JOB_CHANGE", source, details },
  });
  return { flagged: true as const, flag };
}

/** Resolves a flag; with apply=true a proposed role change is written to the mentor. */
export async function resolveFlag(flagId: string, { apply = false }: { apply?: boolean } = {}) {
  const flag = await prisma.freshnessFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new NotFoundError("Flag");
  if (flag.status !== "OPEN") throw new ConflictError("Flag is already resolved");
  const now = new Date();

  if (apply) {
    const change = parseRoleChange(flag.details);
    if (!change) throw new ValidationError("This flag has no proposed change to apply");
    return prisma.$transaction(async (tx) => {
      await tx.mentor.update({
        where: { id: flag.mentorId },
        data: { title: change.to.title ?? null, company: change.to.company ?? null, lastVerifiedAt: now },
      });
      return tx.freshnessFlag.update({ where: { id: flagId }, data: { status: "RESOLVED", resolvedAt: now } });
    });
  }
  return prisma.freshnessFlag.update({ where: { id: flagId }, data: { status: "RESOLVED", resolvedAt: now } });
}

export async function listOpenFlags() {
  return prisma.freshnessFlag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: { mentor: { select: { id: true, name: true, email: true } } },
  });
}

/** Opens a STALE flag for every active mentor past the freshness window. Safe to run repeatedly (e.g. daily cron). */
export async function scanStaleMentors(now = new Date()) {
  const cutoff = new Date(now.getTime() - staleAfterDays() * 24 * 60 * 60 * 1000);
  const stale = await prisma.mentor.findMany({
    where: {
      active: true,
      lastVerifiedAt: { lte: cutoff },
      flags: { none: { reason: "STALE", status: "OPEN" } },
    },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.freshnessFlag.createMany({
      data: stale.map((m) => ({
        mentorId: m.id,
        reason: "STALE",
        source: "SYSTEM",
        details: `Not verified in ${staleAfterDays()}+ days`,
      })),
    });
  }
  return { flagged: stale.length };
}
