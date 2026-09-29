import { handle, readJson } from "@/lib/http";
import { resolveFlag } from "@/lib/services/mentors";

export const POST = handle<{ id: string }>(async (req, { id }) => {
  const { apply } = await readJson(req);
  return Response.json({ flag: await resolveFlag(id, { apply: apply === true }) });
});
