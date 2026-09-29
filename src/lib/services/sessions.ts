import { prisma } from "../db";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { rankMentors } from "../matching";
import { parseTags } from "../tags";
import { SESSION_STATUSES, sessionInput, type SessionInput, type SessionStatus } from "../validation";
import { loadCandidates } from "./candidates";

const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function listSessions({ upcoming }: { upcoming?: boolean } = {}, now = new Date()) {
  return prisma.session.findMany({
    where: upcoming ? { scheduledAt: { gte: now }, status: "SCHEDULED" } : undefined,
    orderBy: { scheduledAt: "asc" },
    include: { mentor: { select: { id: true, name: true, company: true } } },
  });
}

export async function getSession(id: string) {
  const session = await prisma.session.findUnique({ where: { id }, include: { mentor: true } });
  if (!session) throw new NotFoundError("Session");
  return session;
}

async function assertMentorAvailable(mentorId: string, scheduledAt: Date, ignoreSessionId?: string) {
  const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
  if (!mentor) throw new NotFoundError("Mentor");
  if (!mentor.active) throw new ValidationError(`${mentor.name} is inactive`);
  const clash = await prisma.session.findFirst({
    where: {
      mentorId,
      status: "SCHEDULED",
      id: ignoreSessionId ? { not: ignoreSessionId } : undefined,
      scheduledAt: {
        gt: new Date(scheduledAt.getTime() - CONFLICT_WINDOW_MS),
        lt: new Date(scheduledAt.getTime() + CONFLICT_WINDOW_MS),
      },
    },
  });
  if (clash) throw new ConflictError(`${mentor.name} is already booked for "${clash.title}" around that time`);
}

export async function createSession(input: SessionInput) {
  const data = sessionInput.parse(input);
  if (data.mentorId) await assertMentorAvailable(data.mentorId, data.scheduledAt);
  return prisma.session.create({ data: { ...data, mentorId: data.mentorId || null } });
}

/** Ranks mentors for a curriculum session, skipping anyone double-booked at that time. */
export async function suggestMentorsForSession(sessionId: string, { limit = 5, now = new Date() } = {}) {
  const session = await getSession(sessionId);
  const windowStart = new Date(session.scheduledAt.getTime() - CONFLICT_WINDOW_MS);
  const windowEnd = new Date(session.scheduledAt.getTime() + CONFLICT_WINDOW_MS);
  const busy = await prisma.session.findMany({
    where: {
      id: { not: session.id },
      status: "SCHEDULED",
      mentorId: { not: null },
      scheduledAt: { gt: windowStart, lt: windowEnd },
    },
    select: { mentorId: true },
  });
  const busyIds = new Set(busy.map((b) => b.mentorId));
  const candidates = (await loadCandidates(now)).filter((c) => !busyIds.has(c.id));
  return rankMentors(candidates, { topics: parseTags(session.topics) }, { limit, now });
}

export async function assignMentor(sessionId: string, mentorId: string | null) {
  const session = await getSession(sessionId);
  if (mentorId) await assertMentorAvailable(mentorId, session.scheduledAt, session.id);
  return prisma.session.update({ where: { id: sessionId }, data: { mentorId } });
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus) {
  if (!SESSION_STATUSES.includes(status)) throw new ValidationError(`Invalid status ${status}`);
  const session = await getSession(sessionId);
  if (status === "COMPLETED" && !session.mentorId) {
    throw new ValidationError("Assign a mentor before marking the session completed");
  }
  return prisma.session.update({ where: { id: sessionId }, data: { status } });
}

export async function deleteSession(sessionId: string) {
  await getSession(sessionId);
  await prisma.session.delete({ where: { id: sessionId } });
}
