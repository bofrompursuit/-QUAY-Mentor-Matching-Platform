import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createMentor } from "@/lib/services/mentors";
import { createStartup } from "@/lib/services/startups";
import { assignMentor, createSession, suggestMentorsForSession, updateSessionStatus } from "@/lib/services/sessions";
import { createRequest, recommendMentorsForStartup, respondToRequest } from "@/lib/services/requests";
import { GET as suggestionsRoute } from "@/app/api/sessions/[id]/suggestions/route";
import { POST as _requestsRoute } from "@/app/api/requests/route";
import { DAY, mentorData, resetDb } from "../helpers";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request("http://t/api", { method: "POST", body: JSON.stringify(body) });

const requestsRoute = (r: Request) => _requestsRoute(r, { params: Promise.resolve({}) });

beforeEach(resetDb);

describe("session auto-suggestions", () => {
  it("ranks relevant mentors and skips ones double-booked at that time", async () => {
    const when = new Date(Date.now() + 5 * DAY);
    const a = await createMentor(mentorData({ name: "Ana", expertise: "fundraising, legal" }));
    const b = await createMentor(mentorData({ name: "Ben", expertise: "fundraising" }));
    await createMentor(mentorData({ name: "Cy", expertise: "design" }));
    await createMentor(mentorData({ name: "Di", expertise: "legal", active: false }));

    const session = await createSession({ title: "Term sheets", topics: "legal, VC", scheduledAt: when });
    let suggestions = await suggestMentorsForSession(session.id);
    expect(suggestions.map((s) => s.name)).toEqual(["Ana", "Ben"]);

    // Ana is booked an hour later for another session, so she drops out.
    await createSession({ title: "Other", topics: "legal", scheduledAt: new Date(when.getTime() + 36e5), mentorId: a.id });
    suggestions = await suggestMentorsForSession(session.id);
    expect(suggestions.map((s) => s.mentorId)).toEqual([b.id]);
  });

  it("prevents assigning a double-booked mentor and completing without a mentor", async () => {
    const when = new Date(Date.now() + 2 * DAY);
    const m = await createMentor(mentorData());
    const s1 = await createSession({ title: "A", topics: "fundraising", scheduledAt: when, mentorId: m.id });
    const s2 = await createSession({ title: "B", topics: "fundraising", scheduledAt: when });
    await expect(assignMentor(s2.id, m.id)).rejects.toThrow(/already booked/);
    await expect(updateSessionStatus(s2.id, "COMPLETED")).rejects.toThrow(/Assign a mentor/);
    await expect(assignMentor(s1.id, m.id)).resolves.toBeTruthy(); // re-assigning same session is fine
  });

  it("serves suggestions over the API", async () => {
    await createMentor(mentorData({ expertise: "hiring" }));
    const s = await createSession({ title: "Hiring", topics: "recruiting", scheduledAt: new Date() });
    const res = await suggestionsRoute(new Request("http://t/x"), ctx(s.id));
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toHaveLength(1);
    expect((await suggestionsRoute(new Request("http://t/x"), ctx("nope"))).status).toBe(404);
  });
});

describe("startup requests", () => {
  it("recommends from startup needs, creates scored requests, and blocks duplicates", async () => {
    const mentor = await createMentor(mentorData({ name: "Fin", expertise: "fintech, legal" }));
    const startup = await createStartup({ name: "PayCo", needs: "fintech" });

    const rec = await recommendMentorsForStartup(startup.id);
    expect(rec.topics).toEqual(["fintech"]);
    expect(rec.results[0]).toMatchObject({ mentorId: mentor.id, alreadyRequested: false });

    const res = await requestsRoute(post({ startupId: startup.id, mentorId: mentor.id, topic: "fintech" }));
    expect(res.status).toBe(201);
    expect((await res.json()).request.matchScore).toBeGreaterThan(0);

    const dup = await requestsRoute(post({ startupId: startup.id, mentorId: mentor.id, topic: "legal" }));
    expect(dup.status).toBe(409);
    expect((await recommendMentorsForStartup(startup.id)).results[0].alreadyRequested).toBe(true);
  });

  it("validates request input and inactive mentors", async () => {
    const startup = await createStartup({ name: "X" });
    const inactive = await createMentor(mentorData({ active: false }));
    expect((await requestsRoute(post({ startupId: startup.id }))).status).toBe(400);
    expect((await requestsRoute(post({ startupId: startup.id, mentorId: inactive.id, topic: "t" }))).status).toBe(400);
  });

  it("enforces the status lifecycle and records response time once", async () => {
    const m = await createMentor(mentorData());
    const s = await createStartup({ name: "Y" });
    const r = await createRequest({ startupId: s.id, mentorId: m.id, topic: "fundraising" });
    await expect(respondToRequest(r.id, "COMPLETED")).rejects.toThrow(/Cannot move/);
    const accepted = await respondToRequest(r.id, "ACCEPTED");
    const completed = await respondToRequest(r.id, "COMPLETED");
    expect(completed.respondedAt).toEqual(accepted.respondedAt);
    await expect(respondToRequest(r.id, "DECLINED")).rejects.toThrow();
    expect(await prisma.mentorRequest.count()).toBe(1);
  });
});
