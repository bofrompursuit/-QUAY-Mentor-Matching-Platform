import { boolParam, handle, readJson } from "@/lib/http";
import { createMentor, listMentors } from "@/lib/services/mentors";
import type { MentorInput } from "@/lib/validation";

export const GET = handle(async (req) => {
  const u = new URL(req.url).searchParams;
  const mentors = await listMentors({
    q: u.get("q") ?? undefined,
    tag: u.get("tag") ?? undefined,
    active: boolParam(u.get("active")),
    stale: boolParam(u.get("stale")),
  });
  return Response.json({ mentors });
});

export const POST = handle(async (req) => {
  const mentor = await createMentor((await readJson(req)) as MentorInput);
  return Response.json({ mentor }, { status: 201 });
});
