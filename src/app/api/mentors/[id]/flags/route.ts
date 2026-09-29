import { z } from "zod";
import { handle, readJson } from "@/lib/http";
import { flagMentor } from "@/lib/services/mentors";

const body = z.object({
  reason: z.enum(["JOB_CHANGE", "STALE", "BOUNCED_EMAIL", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const { reason, details } = body.parse(await readJson(req));
  return Response.json({ flag: await flagMentor(id, reason, "MANUAL", details) }, { status: 201 });
});
