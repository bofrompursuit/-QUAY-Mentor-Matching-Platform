import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/services/analytics";
import { GET as analyticsRoute } from "@/app/api/analytics/route";
import { DAY, mentorData, resetDb } from "../helpers";

beforeEach(resetDb);

describe("dashboard metrics", () => {
  it("returns empty-safe metrics", async () => {
    const m = await getDashboardMetrics();
    expect(m.connections.acceptanceRate).toBeNull();
    expect(m.network.totalMentors).toBe(0);
    expect(m.connections.weekly).toHaveLength(8);
  });

  it("computes connection quality and network health", async () => {
    const now = new Date();
    const ago = (d: number) => new Date(now.getTime() - d * DAY);
    const a = await prisma.mentor.create({ data: { ...mentorData({ expertise: "fundraising" }) } });
    const b = await prisma.mentor.create({ data: { ...mentorData({ expertise: "legal" }), lastVerifiedAt: ago(300) } });
    await prisma.mentor.create({ data: { ...mentorData(), active: false } });
    const s = await prisma.startup.create({ data: { name: "S" } });
    const req = (mentorId: string, status: string, topic: string, respondedHours?: number) =>
      prisma.mentorRequest.create({
        data: {
          startupId: s.id, mentorId, status, topic, createdAt: ago(5),
          respondedAt: respondedHours != null ? new Date(ago(5).getTime() + respondedHours * 36e5) : null,
        },
      });
    await req(a.id, "ACCEPTED", "fundraising", 2);
    await req(a.id, "COMPLETED", "fundraising", 4);
    await req(b.id, "DECLINED", "legal", 10);
    await req(b.id, "PENDING", "fundraising");
    await prisma.session.create({ data: { title: "x", scheduledAt: new Date(now.getTime() + DAY) } });
    await prisma.session.create({ data: { title: "y", scheduledAt: ago(3), status: "COMPLETED", mentorId: a.id } });

    const m = await getDashboardMetrics(now);
    expect(m.connections).toMatchObject({ totalRequests: 4, acceptanceRate: 67, medianResponseHours: 4 });
    expect(m.sessions).toMatchObject({ upcoming: 1, upcomingUnassigned: 1, completed: 1 });
    expect(m.network).toMatchObject({ totalMentors: 3, activeMentors: 2, engagedLast90Days: 1, responseRate: 75, staleMentors: 1, stalePercent: 50 });
    expect(m.topMentors[0]).toMatchObject({ id: a.id, engagements: 3 });
    expect(m.topicDemand[0]).toEqual({ topic: "fundraising", requests: 3, mentors: 1 });

    const res = await analyticsRoute(new Request("http://t/api/analytics"), { params: Promise.resolve({}) });
    expect((await res.json()).connections.totalRequests).toBe(4);
  });
});
