import crypto from "node:crypto";

const MAX_SKEW_SECONDS = 60 * 5;

/** Verifies Slack's v0 request signature (https://api.slack.com/authentication/verifying-requests-from-slack). */
export function verifySlackSignature({
  signingSecret,
  timestamp,
  rawBody,
  signature,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  signingSecret: string;
  timestamp: string | null;
  rawBody: string;
  signature: string | null;
  nowSeconds?: number;
}): boolean {
  if (!signingSecret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return false;
  const expected =
    "v0=" + crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signSlackBody(signingSecret: string, timestamp: string, rawBody: string): string {
  return "v0=" + crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
}

export interface ParsedMentor {
  name?: string;
  email?: string;
  title?: string;
  company?: string;
  expertise?: string;
  linkedinUrl?: string;
  bio?: string;
}

/** Slack wraps links as <mailto:a@b.com|a@b.com> and <https://x|label>. */
export function unwrapSlackFormatting(text: string): string {
  return text
    .replace(/<mailto:([^|>]+)(?:\|[^>]*)?>/g, "$1")
    .replace(/<(https?:\/\/[^|>]+)(?:\|[^>]*)?>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const KEY_MAP: Record<string, keyof ParsedMentor> = {
  name: "name",
  email: "email",
  title: "title",
  role: "title",
  company: "company",
  org: "company",
  expertise: "expertise",
  skills: "expertise",
  topics: "expertise",
  tags: "expertise",
  linkedin: "linkedinUrl",
  bio: "bio",
};

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const LINKEDIN_RE = /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[^\s|,;]+/i;

function splitRole(role: string): { title?: string; company?: string } {
  const m = role.match(/^(.*?)\s+(?:@|at)\s+(.+)$/i);
  if (m) return { title: m[1].trim(), company: m[2].trim() };
  return { title: role.trim() };
}

/**
 * Parses mentor details a teammate drops in Slack. Accepts either
 *   key: value pairs (newline- or semicolon-separated), or
 *   Name | email | Title @ Company | tag, tag | linkedin-url
 */
export function parseMentorText(input: string): { data: ParsedMentor; errors: string[] } {
  const text = unwrapSlackFormatting(input).trim();
  const data: ParsedMentor = {};

  const pairs = text
    .split(/\n|;/)
    .map((l) => l.match(/^\s*([a-z]+)\s*:\s*(.+)$/i))
    .filter((m): m is RegExpMatchArray => !!m && !!KEY_MAP[m[1].toLowerCase()]);

  if (pairs.length) {
    for (const m of pairs) data[KEY_MAP[m[1].toLowerCase()]] = m[2].trim();
    if (data.title && !data.company) Object.assign(data, splitRole(data.title));
  } else if (text.includes("|")) {
    const parts = text.split("|").map((p) => p.trim());
    for (const part of parts) {
      if (!part) continue;
      if (LINKEDIN_RE.test(part)) data.linkedinUrl ??= part.match(LINKEDIN_RE)![0];
      else if (EMAIL_RE.test(part) && !data.email) data.email = part.match(EMAIL_RE)![0];
      else if (!data.name) data.name = part;
      else if (!data.title && /\s(@|at)\s/i.test(part)) Object.assign(data, splitRole(part));
      else if (!data.expertise) data.expertise = part;
      else if (!data.title) Object.assign(data, splitRole(part));
    }
  }

  // Fallbacks so a loosely formatted message still yields contact info.
  data.email ??= text.match(EMAIL_RE)?.[0];
  data.linkedinUrl ??= text.match(LINKEDIN_RE)?.[0];
  if (data.email) data.email = data.email.toLowerCase();

  const errors: string[] = [];
  if (!data.name) errors.push("Missing name");
  if (!data.email) errors.push("Missing email");
  return { data, errors };
}
