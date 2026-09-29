import crypto from "node:crypto";
import { handle, readJson } from "@/lib/http";
import { reportRoleChange } from "@/lib/services/mentors";
import { jobChangeWebhook } from "@/lib/validation";

function secretMatches(given: string | null): boolean {
  const expected = process.env.JOB_CHANGE_WEBHOOK_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Receives role-change events from an enrichment provider (People Data Labs,
 * Clay, a Zapier/Make flow, etc.) instead of scraping LinkedIn. Changes are
 * queued as OPEN flags for an admin to apply or dismiss.
 */
export const POST = handle(async (req) => {
  if (!secretMatches(req.headers.get("x-webhook-secret"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { email, title, company } = jobChangeWebhook.parse(await readJson(req));
  const result = await reportRoleChange(email, { title, company }, "WEBHOOK");
  return Response.json(result, { status: result.flagged ? 202 : 200 });
});
