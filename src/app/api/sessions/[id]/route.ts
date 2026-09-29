import { z } from "zod";
import { handle, readJson } from "@/lib/http";
import { assignMentor, deleteSession, getSession, updateSessionStatus } from "@/lib/services/sessions";
import { SESSION_STATUSES } from "@/lib/validation";

const patch = z.object({
  mentorId: z.string().nullable().optional(),
  status: z.enum(SESSION_STATUSES).optional(),
});

export const GET = handle<{ id: string }>(async (_req, { id }) => Response.json({ session: await getSession(id) }));

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const body = patch.parse(await readJson(req));
  if (body.mentorId !== undefined) await assignMentor(id, body.mentorId);
  if (body.status) await updateSessionStatus(id, body.status);
  return Response.json({ session: await getSession(id) });
});

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  await deleteSession(id);
  return new Response(null, { status: 204 });
});
