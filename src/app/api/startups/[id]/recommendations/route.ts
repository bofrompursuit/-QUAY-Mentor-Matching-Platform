import { handle } from "@/lib/http";
import { recommendMentorsForStartup } from "@/lib/services/requests";

export const GET = handle<{ id: string }>(async (req, { id }) => {
  const topics = new URL(req.url).searchParams.get("topics") ?? undefined;
  return Response.json(await recommendMentorsForStartup(id, { topics }));
});
