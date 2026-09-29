import { describe, expect, it } from "vitest";
import { detectRoleChange, isStale } from "@/lib/freshness";
import { parseMentorText, signSlackBody, verifySlackSignature } from "@/lib/slack";

describe("freshness", () => {
  const now = new Date("2026-09-01");
  it("flags records older than the window", () => {
    expect(isStale(new Date("2026-01-01"), now, 180)).toBe(true);
    expect(isStale(new Date("2026-08-01"), now, 180)).toBe(false);
  });
  it("detects role changes, ignoring case, punctuation and blanks", () => {
    expect(detectRoleChange({ title: "CTO", company: "Acme" }, { company: "Globex" })).toBe(true);
    expect(detectRoleChange({ title: "CTO", company: "Acme, Inc." }, { title: "cto", company: "acme inc" })).toBe(false);
    expect(detectRoleChange({ title: "CTO", company: "Acme" }, { title: "", company: null })).toBe(false);
  });
});

describe("slack", () => {
  it("parses pipe format with Slack link formatting", () => {
    const { data, errors } = parseMentorText(
      "Jane Doe | <mailto:Jane@Acme.com|Jane@Acme.com> | VP Product @ Acme | fintech, gtm | <https://www.linkedin.com/in/jane>",
    );
    expect(errors).toEqual([]);
    expect(data).toMatchObject({
      name: "Jane Doe", email: "jane@acme.com", title: "VP Product", company: "Acme",
      expertise: "fintech, gtm", linkedinUrl: "https://www.linkedin.com/in/jane",
    });
  });

  it("parses key/value format", () => {
    const { data } = parseMentorText("name: Bo Smith; email: bo@x.io; role: CFO at Initech; skills: finance");
    expect(data).toMatchObject({ name: "Bo Smith", email: "bo@x.io", title: "CFO", company: "Initech", expertise: "finance" });
  });

  it("reports missing required fields", () => {
    expect(parseMentorText("just some text").errors).toEqual(["Missing name", "Missing email"]);
  });

  it("verifies signatures and rejects tampering or replay", () => {
    const ts = "1700000000";
    const body = "text=hello";
    const sig = signSlackBody("secret", ts, body);
    const base = { signingSecret: "secret", timestamp: ts, rawBody: body, signature: sig, nowSeconds: 1700000010 };
    expect(verifySlackSignature(base)).toBe(true);
    expect(verifySlackSignature({ ...base, rawBody: "text=evil" })).toBe(false);
    expect(verifySlackSignature({ ...base, nowSeconds: 1700001000 })).toBe(false);
    expect(verifySlackSignature({ ...base, signingSecret: "" })).toBe(false);
  });
});
