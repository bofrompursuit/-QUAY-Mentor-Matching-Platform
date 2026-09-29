import { handle } from "@/lib/http";
import { scanStaleMentors } from "@/lib/services/mentors";

// Point a daily cron (e.g. Vercel Cron) at this endpoint.
export const POST = handle(async () => Response.json(await scanStaleMentors()));
export const GET = POST;
