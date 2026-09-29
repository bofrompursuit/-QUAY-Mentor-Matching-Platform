import { prisma } from "../db";
import type { MatchCandidate } from "../matching";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOAD_WINDOW_MS = 14 * DAY_MS;

/** Loads active mentors with the engagement stats the matcher needs. */
export async function loadCandidates(now = new Date()): Promise<MatchCandidate[]> {
  const mentors = await prisma.mentor.findMany({
    where: { active: true },
    include: {
      sessions: { where: { status: { not: "CANCELLED" } }, select: { scheduledAt: true } },
      requests: { select: { status: true } },
    },
  });

  return mentors.map((m) => {
    const recentSessions = m.sessions.filter(
      (s) => Math.abs(s.scheduledAt.getTime() - now.getTime()) <= LOAD_WINDOW_MS,
    ).length;
    const responded = m.requests.filter((r) => r.status !== "PENDING").length;
    const accepted = m.requests.filter((r) => r.status === "ACCEPTED" || r.status === "COMPLETED").length;
    return {
      id: m.id,
      name: m.name,
      title: m.title,
      company: m.company,
      expertise: m.expertise,
      active: m.active,
      lastVerifiedAt: m.lastVerifiedAt,
      stats: {
        sessionsLed: m.sessions.length,
        recentSessions,
        requestsReceived: m.requests.length,
        requestsResponded: responded,
        requestsAccepted: accepted,
      },
    };
  });
}
