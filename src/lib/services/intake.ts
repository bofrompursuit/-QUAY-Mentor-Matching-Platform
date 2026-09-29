import { errorMessage } from "../errors";
import { parseMentorText } from "../slack";
import { upsertMentorByEmail } from "./mentors";

export type IntakeResult =
  | { ok: true; created: boolean; mentorId: string; message: string }
  | { ok: false; message: string };

export const INTAKE_HELP =
  "Add or update a mentor, e.g.\n" +
  "`/add-mentor Jane Doe | jane@acme.com | VP Product @ Acme | fintech, go-to-market | https://linkedin.com/in/jane`\n" +
  "or key/value lines: `name: Jane Doe; email: jane@acme.com; company: Acme; expertise: fintech`";

/** Parses a Slack message and creates or updates the matching mentor record. */
export async function intakeMentorFromText(text: string): Promise<IntakeResult> {
  if (!text.trim() || /^help$/i.test(text.trim())) return { ok: false, message: INTAKE_HELP };
  const { data, errors } = parseMentorText(text);
  if (errors.length) return { ok: false, message: `${errors.join(", ")}.\n${INTAKE_HELP}` };

  try {
    const { mentor, created } = await upsertMentorByEmail(
      {
        name: data.name!,
        email: data.email!,
        title: data.title,
        company: data.company,
        linkedinUrl: data.linkedinUrl,
        expertise: data.expertise,
        bio: data.bio,
      },
      "SLACK",
    );
    return {
      ok: true,
      created,
      mentorId: mentor.id,
      message: `${created ? "Added" : "Updated"} mentor *${mentor.name}* (${mentor.email}).`,
    };
  } catch (err) {
    return { ok: false, message: `Couldn't save mentor: ${errorMessage(err)}` };
  }
}
