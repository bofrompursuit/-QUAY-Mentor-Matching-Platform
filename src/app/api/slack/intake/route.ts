import { verifySlackSignature } from "@/lib/slack";
import { intakeMentorFromText } from "@/lib/services/intake";

/**
 * Slack intake endpoint. Handles:
 *  - Slash commands (form-encoded `text`), e.g. `/add-mentor Jane | jane@x.com | ...`
 *  - Events API `url_verification` and `message` / `app_mention` events (JSON)
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
    rawBody,
  });
  if (!ok) return Response.json({ error: "Invalid Slack signature" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = JSON.parse(rawBody);
    if (payload.type === "url_verification") return Response.json({ challenge: payload.challenge });
    const event = payload.event;
    // Ignore bot messages (including our own) and edits to avoid loops.
    if (!event || event.bot_id || event.subtype) return Response.json({ ok: true });
    const text = String(event.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();
    const result = await intakeMentorFromText(text);
    return Response.json({ ok: result.ok, message: result.message });
  }

  const form = new URLSearchParams(rawBody);
  const result = await intakeMentorFromText(form.get("text") ?? "");
  return Response.json({ response_type: "ephemeral", text: result.message });
}
