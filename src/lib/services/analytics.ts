import { prisma } from "../db";
import { daysSince, isStale } from "../freshness";
import { parseTags } from "../tags";

const DAY_MS = 24 * 60 * 60 * 1000;

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pct(n: number, d: number): number | null {
  return d ? Math.round((n / d) * 100) : null;
}

export interface DashboardMetrics {
  connections: {
    totalRequests: number;
    last30Days: number;
    byStatus: Record<string, number>;
    acceptanceRate: number | null; // % of responded requests accepted
    medianResponseHours: number | null;
    weekly: { weekStart: string; requests: number; accepted: number }[];
  };
  sessions: {
    upcoming: number;
    upcomingUnassigned: number;
    completed: number;
    completedLast30Days: number;
  };
  network: {
    totalMentors: number;
    activeMentors: number;
    engagedLast90Days: number;
    responseRate: number | null; // % of received requests the mentor answered
    staleMentors: number;
    stalePercent: number | null;
    medianDaysSinceVerified: number | null;
    openFlags: number;
    addedLast30Days: number;
    bySource: Record<string, number>;
  };
  topMentors: { id: string; name: string; engagements: number }[];
  topicDemand: { topic: string; requests: number; mentors: number }[];
}

export async function getDashboardMetrics(now = new Date()): Promise<DashboardMetrics> {
  const [mentors, requests, sessions, openFlags] = await Promise.all([
    prisma.mentor.findMany({ select: { id: true, name: true, active: true, expertise: true, source: true, lastVerifiedAt: true, createdAt: true } }),
    prisma.mentorRequest.findMany({ select: { mentorId: true, status: true, topic: true, createdAt: true, respondedAt: true } }),
    prisma.session.findMany({ select: { mentorId: true, status: true, scheduledAt: true } }),
    prisma.freshnessFlag.count({ where: { status: "OPEN" } }),
  ]);

  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);

  // Connections
  const byStatus: Record<string, number> = { PENDING: 0, ACCEPTED: 0, DECLINED: 0, COMPLETED: 0 };
  for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const accepted = byStatus.ACCEPTED + byStatus.COMPLETED;
  const responded = accepted + byStatus.DECLINED;
  const responseHours = requests
    .filter((r) => r.respondedAt)
    .map((r) => (r.respondedAt!.getTime() - r.createdAt.getTime()) / 36e5);

  const weekly: DashboardMetrics["connections"]["weekly"] = [];
  for (let i = 7; i >= 0; i--) {
    const start = since((i + 1) * 7);
    const end = since(i * 7);
    const inWeek = requests.filter((r) => r.createdAt > start && r.createdAt <= end);
    weekly.push({
      weekStart: start.toISOString().slice(0, 10),
      requests: inWeek.length,
      accepted: inWeek.filter((r) => r.status === "ACCEPTED" || r.status === "COMPLETED").length,
    });
  }

  // Sessions
  const upcoming = sessions.filter((s) => s.status === "SCHEDULED" && s.scheduledAt >= now);
  const completed = sessions.filter((s) => s.status === "COMPLETED");

  // Network health
  const active = mentors.filter((m) => m.active);
  const engagedIds = new Set<string>();
  for (const s of sessions) {
    if (s.mentorId && s.status !== "CANCELLED" && s.scheduledAt >= since(90) && s.scheduledAt <= now) engagedIds.add(s.mentorId);
  }
  for (const r of requests) {
    if ((r.status === "ACCEPTED" || r.status === "COMPLETED") && r.createdAt >= since(90)) engagedIds.add(r.mentorId);
  }
  const stale = active.filter((m) => isStale(m.lastVerifiedAt, now));
  const bySource: Record<string, number> = {};
  for (const m of mentors) bySource[m.source] = (bySource[m.source] ?? 0) + 1;

  const engagementCounts = new Map<string, number>();
  for (const s of sessions) if (s.mentorId && s.status !== "CANCELLED") engagementCounts.set(s.mentorId, (engagementCounts.get(s.mentorId) ?? 0) + 1);
  for (const r of requests) if (r.status === "ACCEPTED" || r.status === "COMPLETED") engagementCounts.set(r.mentorId, (engagementCounts.get(r.mentorId) ?? 0) + 1);
  const nameById = new Map(mentors.map((m) => [m.id, m.name]));
  const topMentors = [...engagementCounts.entries()]
    .filter(([id]) => nameById.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, engagements]) => ({ id, name: nameById.get(id)!, engagements }));

  // Demand vs. supply: which requested topics have few mentors to cover them.
  const demand = new Map<string, number>();
  for (const r of requests) for (const t of parseTags(r.topic)) demand.set(t, (demand.get(t) ?? 0) + 1);
  const topicDemand = [...demand.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({
      topic,
      requests: count,
      mentors: active.filter((m) => parseTags(m.expertise).includes(topic)).length,
    }));

  return {
    connections: {
      totalRequests: requests.length,
      last30Days: requests.filter((r) => r.createdAt >= since(30)).length,
      byStatus,
      acceptanceRate: pct(accepted, responded),
      medianResponseHours: responseHours.length ? Math.round(median(responseHours)! * 10) / 10 : null,
      weekly,
    },
    sessions: {
      upcoming: upcoming.length,
      upcomingUnassigned: upcoming.filter((s) => !s.mentorId).length,
      completed: completed.length,
      completedLast30Days: completed.filter((s) => s.scheduledAt >= since(30)).length,
    },
    network: {
      totalMentors: mentors.length,
      activeMentors: active.length,
      engagedLast90Days: engagedIds.size,
      responseRate: pct(requests.filter((r) => r.status !== "PENDING").length, requests.length),
      staleMentors: stale.length,
      stalePercent: pct(stale.length, active.length),
      medianDaysSinceVerified: median(active.map((m) => daysSince(m.lastVerifiedAt, now))),
      openFlags,
      addedLast30Days: mentors.filter((m) => m.createdAt >= since(30)).length,
      bySource,
    },
    topMentors,
    topicDemand,
  };
}
