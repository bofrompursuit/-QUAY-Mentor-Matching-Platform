import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signSlackBody } from "@/lib/slack";
import { createMentor, reportRoleChange, resolveFlag, scanStaleMentors, updateMentor, verifyMentor } from "@/lib/services/mentors";
import { POST as _createMentorRoute, GET as _listMentorsRoute } from "@/app/api/mentors/route";
import { DELETE as deleteMentorRoute, PATCH as patchMentorRoute } from "@/app/api/mentors/[id]/route";
import { POST as slackRoute } from "@/app/api/slack/intake/route";
import { POST as _webhookRoute } from "@/app/api/webhooks/job-change/route";
import { DAY, mentorData, resetDb } from "../helpers";

const json = (body: unknown, method = "POST", headers: Record<string, string> = {}) =>
  new Request("http://t/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const createMentorRoute = (r: Request) => _createMentorRoute(r, { params: Promise.resolve({}) });
const listMentorsRoute = (r: Request) => _listMentorsRoute(r, { params: Promise.resolve({}) });
const webhookRoute = (r: Request) => _webhookRoute(r, { params: Promise.resolve({}) });

beforeEach(resetDb);

describe("mentor CRUD", () => {
  it("creates, lists, updates and deletes via the API", async () => {
    const res = await createMentorRoute(json({ name: "Ada", email: "ADA@x.com", expertise: "VC, Hiring" }));
    expect(res.status).toBe(201);
    const { mentor } = await res.json();
    expect(mentor).toMatchObject({ email: "ada@x.com", expertise: "fundraising, hiring" });

    expect((await createMentorRoute(json({ name: "Ada2", email: "ada@x.com" }))).status).toBe(409);
    expect((await createMentorRoute(json({ name: "", email: "bad" }))).status).toBe(400);

    const list = await (await listMentorsRoute(new Request("http://t/api/mentors?q=hiring"))).json();
    expect(list.mentors).toHaveLength(1);

    const patched = await patchMentorRoute(json({ bio: "Hi" }, "PATCH"), ctx(mentor.id));
    expect((await patched.json()).mentor).toMatchObject({ bio: "Hi", expertise: "fundraising, hiring" }); // partial update keeps other fields

    expect((await deleteMentorRoute(new Request("http://t"), ctx(mentor.id))).status).toBe(204);
    expect((await deleteMentorRoute(new Request("http://t"), ctx(mentor.id))).status).toBe(404);
  });
});

describe("freshness flags", () => {
  it("logs a resolved JOB_CHANGE when an admin edits the role", async () => {
    const m = await createMentor(mentorData({ title: "CTO", company: "Acme" }));
    await updateMentor(m.id, { company: "Globex" });
    const flags = await prisma.freshnessFlag.findMany({ where: { mentorId: m.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ reason: "JOB_CHANGE", status: "RESOLVED" });
  });

  it("queues webhook role changes for review, dedupes, and applies on approval", async () => {
    process.env.JOB_CHANGE_WEBHOOK_SECRET = "s3cret";
    const m = await createMentor(mentorData({ email: "w@x.com", title: "CTO", company: "Acme" }));
    const body = { email: "W@x.com", title: "VP Eng", company: "Globex" };

    expect((await webhookRoute(json(body, "POST", { "x-webhook-secret": "wrong" }))).status).toBe(401);
    expect((await webhookRoute(json(body, "POST", { "x-webhook-secret": "s3cret" }))).status).toBe(202);
    await webhookRoute(json(body, "POST", { "x-webhook-secret": "s3cret" }));

    const flags = await prisma.freshnessFlag.findMany({ where: { mentorId: m.id } });
    expect(flags).toHaveLength(1);
    expect((await prisma.mentor.findUnique({ where: { id: m.id } }))!.company).toBe("Acme"); // untouched until approved

    await resolveFlag(flags[0].id, { apply: true });
    expect(await prisma.mentor.findUnique({ where: { id: m.id } })).toMatchObject({ title: "VP Eng", company: "Globex" });
    await expect(resolveFlag(flags[0].id)).rejects.toThrow(/already resolved/);
    expect((await reportRoleChange("w@x.com", { company: "Globex" })).flagged).toBe(false);
  });

  it("stale scan is idempotent and verification clears it", async () => {
    const old = await createMentor(mentorData());
    await prisma.mentor.update({ where: { id: old.id }, data: { lastVerifiedAt: new Date(Date.now() - 400 * DAY) } });
    await createMentor(mentorData());
    expect(await scanStaleMentors()).toEqual({ flagged: 1 });
    expect(await scanStaleMentors()).toEqual({ flagged: 0 });
    await verifyMentor(old.id);
    expect(await prisma.freshnessFlag.count({ where: { status: "OPEN" } })).toBe(0);
  });
});

describe("slack intake", () => {
  const secret = "slack-secret";
  const slackReq = (rawBody: string, contentType = "application/x-www-form-urlencoded", sig?: string) => {
    const ts = String(Math.floor(Date.now() / 1000));
    return new Request("http://t/api/slack/intake", {
      method: "POST",
      body: rawBody,
      headers: {
        "content-type": contentType,
        "x-slack-request-timestamp": ts,
        "x-slack-signature": sig ?? signSlackBody(secret, ts, rawBody),
      },
    });
  };

  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = secret;
  });

  it("creates then updates a mentor from a slash command", async () => {
    const text = "Jane Doe | <mailto:jane@acme.com|jane@acme.com> | VP Product @ Acme | fintech";
    const res = await slackRoute(slackReq(new URLSearchParams({ text }).toString()));
    expect((await res.json()).text).toMatch(/Added mentor/);
    const created = await prisma.mentor.findUnique({ where: { email: "jane@acme.com" } });
    expect(created).toMatchObject({ source: "SLACK", company: "Acme", expertise: "fintech" });

    const update = "name: Jane Doe; email: jane@acme.com; company: Globex";
    const res2 = await slackRoute(slackReq(new URLSearchParams({ text: update }).toString()));
    expect((await res2.json()).text).toMatch(/Updated mentor/);
    const updated = await prisma.mentor.findUnique({ where: { email: "jane@acme.com" } });
    expect(updated).toMatchObject({ company: "Globex", title: "VP Product", expertise: "fintech" });
    expect(await prisma.freshnessFlag.count({ where: { reason: "JOB_CHANGE", source: "SLACK" } })).toBe(1);
  });

  it("rejects bad signatures and answers url_verification", async () => {
    expect((await slackRoute(slackReq("text=x", undefined, "v0=bad"))).status).toBe(401);
    const res = await slackRoute(slackReq(JSON.stringify({ type: "url_verification", challenge: "abc" }), "application/json"));
    expect(await res.json()).toEqual({ challenge: "abc" });
  });

  it("returns help when details are missing", async () => {
    const res = await slackRoute(slackReq(new URLSearchParams({ text: "someone cool" }).toString()));
    expect((await res.json()).text).toMatch(/Missing name, Missing email/);
    expect(await prisma.mentor.count()).toBe(0);
  });
});
