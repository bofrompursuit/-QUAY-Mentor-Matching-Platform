import { handle, readJson } from "@/lib/http";
import { createStartup, listStartups } from "@/lib/services/startups";
import type { StartupInput } from "@/lib/validation";

export const GET = handle(async () => Response.json({ startups: await listStartups() }));

export const POST = handle(async (req) => {
  const startup = await createStartup((await readJson(req)) as StartupInput);
  return Response.json({ startup }, { status: 201 });
});
