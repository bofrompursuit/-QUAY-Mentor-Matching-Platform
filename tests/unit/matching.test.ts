import { describe, expect, it } from "vitest";
import { rankMentors, scoreMentor, type MatchCandidate } from "@/lib/matching";

const now = new Date("2026-09-01T00:00:00Z");
const stats = { sessionsLed: 0, recentSessions: 0, requestsReceived: 0, requestsResponded: 0, requestsAccepted: 0 };
const c = (over: Partial<MatchCandidate> & { id: string }): MatchCandidate => ({
  name: over.id, expertise: "fundraising", active: true, lastVerifiedAt: now, stats, ...over,
});

describe("scoreMentor", () => {
  it("excludes inactive and irrelevant mentors", () => {
    expect(scoreMentor(c({ id: "a", active: false }), { topics: ["fundraising"] }, now)).toBeNull();
    expect(scoreMentor(c({ id: "b", expertise: "design" }), { topics: ["fundraising"] }, now)).toBeNull();
    expect(scoreMentor(c({ id: "c" }), { topics: [] }, now)).toBeNull();
  });

  it("rewards covering more of the requested topics", () => {
    const full = scoreMentor(c({ id: "a", expertise: "fundraising, legal" }), { topics: ["fundraising", "legal"] }, now)!;
    const half = scoreMentor(c({ id: "b", expertise: "fundraising" }), { topics: ["fundraising", "legal"] }, now)!;
    expect(full.score).toBeGreaterThan(half.score);
    expect(full.matchedTopics).toEqual(["fundraising", "legal"]);
  });

  it("uses engagement and responsiveness as tie-breakers", () => {
    const engaged = c({ id: "a", stats: { ...stats, sessionsLed: 5, requestsReceived: 4, requestsResponded: 4, requestsAccepted: 3 } });
    const ghost = c({ id: "b", stats: { ...stats, requestsReceived: 4, requestsResponded: 0 } });
    const [first, second] = rankMentors([ghost, engaged], { topics: ["fundraising"] }, { now });
    expect(first.mentorId).toBe("a");
    expect(second.mentorId).toBe("b");
    expect(first.reasons.join()).toContain("100% response rate");
  });

  it("penalizes stale profiles and heavily booked mentors", () => {
    const fresh = scoreMentor(c({ id: "a" }), { topics: ["fundraising"] }, now)!;
    const stale = scoreMentor(c({ id: "b", lastVerifiedAt: new Date(now.getTime() - 400 * 864e5) }), { topics: ["fundraising"] }, now)!;
    const busy = scoreMentor(c({ id: "c", stats: { ...stats, recentSessions: 3 } }), { topics: ["fundraising"] }, now)!;
    expect(stale.score).toBeLessThan(fresh.score);
    expect(busy.score).toBeLessThan(fresh.score);
    expect(stale.reasons).toContain("Profile may be out of date");
  });

  it("applies the limit", () => {
    const list = Array.from({ length: 8 }, (_, i) => c({ id: `m${i}` }));
    expect(rankMentors(list, { topics: ["vc"] }, { limit: 3, now })).toHaveLength(3);
  });
});
