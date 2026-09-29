import { boolParam, handle, readJson } from "@/lib/http";
import { createSession, listSessions } from "@/lib/services/sessions";
import type { SessionInput } from "@/lib/validation";

export const GET = handle(async (req) => {
  const upcoming = boolParam(new URL(req.url).searchParams.get("upcoming"));
  return Response.json({ sessions: await listSessions({ upcoming }) });
});

export const POST = handle(async (req) => {
  const session = await createSession((await readJson(req)) as SessionInput);
  return Response.json({ session }, { status: 201 });
});
