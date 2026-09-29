import { handle, readJson } from "@/lib/http";
import { createRequest, listRequests } from "@/lib/services/requests";
import type { RequestInput } from "@/lib/validation";

export const GET = handle(async (req) => {
  const u = new URL(req.url).searchParams;
  const requests = await listRequests({
    status: u.get("status") ?? undefined,
    mentorId: u.get("mentorId") ?? undefined,
    startupId: u.get("startupId") ?? undefined,
  });
  return Response.json({ requests });
});

export const POST = handle(async (req) => {
  const request = await createRequest((await readJson(req)) as RequestInput);
  return Response.json({ request }, { status: 201 });
});
