import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { rankMentors, scoreMentor } from "../matching";
import { parseTags } from "../tags";
import { requestInput, type RequestInput, type RequestStatus } from "../validation";
import { loadCandidates } from "./candidates";

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ["ACCEPTED", "DECLINED"],
  ACCEPTED: ["COMPLETED", "DECLINED"],
  DECLINED: [],
  COMPLETED: [],
};

export async function listRequests(filter: { status?: string; mentorId?: string; startupId?: string } = {}) {
  const where: Prisma.MentorRequestWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.mentorId) where.mentorId = filter.mentorId;
  if (filter.startupId) where.startupId = filter.startupId;
  return prisma.mentorRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      mentor: { select: { id: true, name: true, company: true } },
      startup: { select: { id: true, name: true } },
    },
  });
}

/**
 * Recommends mentors for a startup. Topics default to the startup's stated
 * needs. Mentors the startup already has an open request with are marked,
 * not hidden, so founders can see why they're not requestable.
 */
export async function recommendMentorsForStartup(
  startupId: string,
  { topics, limit = 10, now = new Date() }: { topics?: string | string[]; limit?: number; now?: Date } = {},
) {
  const startup = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startup) throw new NotFoundError("Startup");
  const need = parseTags(topics && parseTags(topics).length ? topics : startup.needs);
  if (!need.length) return { topics: need, results: [] };

  const open = await prisma.mentorRequest.findMany({
    where: { startupId, status: { in: ["PENDING", "ACCEPTED"] } },
    select: { mentorId: true },
  });
  const openIds = new Set(open.map((r) => r.mentorId));
  const ranked = rankMentors(await loadCandidates(now), { topics: need }, { limit, now });
  return { topics: need, results: ranked.map((r) => ({ ...r, alreadyRequested: openIds.has(r.mentorId) })) };
}

export async function createRequest(input: RequestInput, now = new Date()) {
  const data = requestInput.parse(input);
  const [startup, mentor] = await Promise.all([
    prisma.startup.findUnique({ where: { id: data.startupId } }),
    prisma.mentor.findUnique({ where: { id: data.mentorId } }),
  ]);
  if (!startup) throw new NotFoundError("Startup");
  if (!mentor) throw new NotFoundError("Mentor");
  if (!mentor.active) throw new ValidationError(`${mentor.name} is not currently taking requests`);

  const existing = await prisma.mentorRequest.findFirst({
    where: { startupId: data.startupId, mentorId: data.mentorId, status: { in: ["PENDING", "ACCEPTED"] } },
  });
  if (existing) throw new ConflictError(`${startup.name} already has an open request with ${mentor.name}`);

  const candidate = (await loadCandidates(now)).find((c) => c.id === mentor.id);
  const match = candidate ? scoreMentor(candidate, { topics: parseTags(data.topic) }, now) : null;

  return prisma.mentorRequest.create({ data: { ...data, matchScore: match?.score ?? null } });
}

export async function respondToRequest(id: string, status: RequestStatus, now = new Date()) {
  const request = await prisma.mentorRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Request");
  const from = request.status as RequestStatus;
  if (!TRANSITIONS[from]?.includes(status)) {
    throw new ValidationError(`Cannot move a ${from.toLowerCase()} request to ${status.toLowerCase()}`);
  }
  return prisma.mentorRequest.update({
    where: { id },
    data: { status, respondedAt: request.respondedAt ?? now },
  });
}
