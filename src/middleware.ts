import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic auth for the whole app, enabled when BASIC_AUTH_USER and
 * BASIC_AUTH_PASSWORD are set. Slack and webhook endpoints verify their own
 * signatures/secrets, so they're excluded.
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, p] = atob(header.slice(6)).split(":");
    if (u === user && p === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="QUAY"' },
  });
}

export const config = {
  matcher: ["/((?!api/slack|api/webhooks|_next/static|_next/image|favicon.ico|icon|apple-touch-icon|manifest.webmanifest).*)"],
};
