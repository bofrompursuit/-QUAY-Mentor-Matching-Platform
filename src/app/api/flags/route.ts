import { handle } from "@/lib/http";
import { listOpenFlags } from "@/lib/services/mentors";

export const GET = handle(async () => Response.json({ flags: await listOpenFlags() }));
