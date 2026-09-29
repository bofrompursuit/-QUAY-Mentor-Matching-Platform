import { handle, readJson } from "@/lib/http";
import { deleteMentor, getMentor, updateMentor } from "@/lib/services/mentors";
import type { MentorUpdate } from "@/lib/validation";

export const GET = handle<{ id: string }>(async (_req, { id }) => Response.json({ mentor: await getMentor(id) }));

export const PATCH = handle<{ id: string }>(async (req, { id }) =>
  Response.json({ mentor: await updateMentor(id, (await readJson(req)) as MentorUpdate) }),
);

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  await deleteMentor(id);
  return new Response(null, { status: 204 });
});
