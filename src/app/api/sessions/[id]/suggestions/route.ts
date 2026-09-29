import { handle } from "@/lib/http";
import { suggestMentorsForSession } from "@/lib/services/sessions";

export const GET = handle<{ id: string }>(async (req, { id }) => {
  const limit = Number(new URL(req.url).searchParams.get("limit")) || 5;
  return Response.json({ suggestions: await suggestMentorsForSession(id, { limit }) });
});
