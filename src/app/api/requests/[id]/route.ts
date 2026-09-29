import { z } from "zod";
import { handle, readJson } from "@/lib/http";
import { respondToRequest } from "@/lib/services/requests";
import { REQUEST_STATUSES } from "@/lib/validation";

const patch = z.object({ status: z.enum(REQUEST_STATUSES) });

export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const { status } = patch.parse(await readJson(req));
  return Response.json({ request: await respondToRequest(id, status) });
});
