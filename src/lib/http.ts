import { toErrorResponse } from "./errors";

export type RouteCtx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };

/** Wraps a route handler so thrown AppErrors / ZodErrors become JSON error responses. */
export function handle<P extends Record<string, string>>(
  fn: (req: Request, params: P) => Promise<Response>,
) {
  return async (req: Request, ctx: RouteCtx<P>) => {
    try {
      return await fn(req, await ctx.params);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function boolParam(v: string | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}
