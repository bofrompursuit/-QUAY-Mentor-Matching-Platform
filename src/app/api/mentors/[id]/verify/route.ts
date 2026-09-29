import { handle } from "@/lib/http";
import { verifyMentor } from "@/lib/services/mentors";

export const POST = handle<{ id: string }>(async (_req, { id }) => Response.json({ mentor: await verifyMentor(id) }));
