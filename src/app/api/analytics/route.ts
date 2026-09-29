import { handle } from "@/lib/http";
import { getDashboardMetrics } from "@/lib/services/analytics";

export const GET = handle(async () => Response.json(await getDashboardMetrics()));
