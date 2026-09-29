"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "@/lib/errors";
import * as mentors from "@/lib/services/mentors";
import * as sessions from "@/lib/services/sessions";
import * as requests from "@/lib/services/requests";
import { createStartup } from "@/lib/services/startups";
import type { RequestStatus, SessionStatus } from "@/lib/validation";

const str = (f: FormData, k: string) => (f.get(k) as string | null) ?? undefined;

function fail(path: string, err: unknown): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(errorMessage(err))}`);
}

function mentorFields(f: FormData) {
  return {
    name: str(f, "name")!,
    email: str(f, "email")!,
    title: str(f, "title"),
    company: str(f, "company"),
    linkedinUrl: str(f, "linkedinUrl"),
    expertise: str(f, "expertise"),
    bio: str(f, "bio"),
  };
}

export async function createMentorAction(f: FormData) {
  let id: string;
  try {
    id = (await mentors.createMentor(mentorFields(f))).id;
  } catch (err) {
    fail("/mentors/new", err);
  }
  redirect(`/mentors/${id}`);
}

export async function updateMentorAction(id: string, f: FormData) {
  try {
    await mentors.updateMentor(id, { ...mentorFields(f), active: f.get("active") === "on" });
  } catch (err) {
    fail(`/mentors/${id}`, err);
  }
  revalidatePath(`/mentors/${id}`);
  redirect(`/mentors/${id}?saved=1`);
}

export async function verifyMentorAction(id: string) {
  await mentors.verifyMentor(id);
  revalidatePath(`/mentors/${id}`);
}

export async function deleteMentorAction(id: string) {
  await mentors.deleteMentor(id);
  redirect("/mentors");
}

export async function flagMentorAction(id: string, f: FormData) {
  await mentors.flagMentor(id, "JOB_CHANGE", "MANUAL", str(f, "details") || "Possible role change reported by team");
  revalidatePath(`/mentors/${id}`);
}

export async function resolveFlagAction(flagId: string, apply: boolean, back: string) {
  try {
    await mentors.resolveFlag(flagId, { apply });
  } catch (err) {
    fail(back, err);
  }
  revalidatePath(back);
}

export async function scanStaleAction() {
  await mentors.scanStaleMentors();
  revalidatePath("/flags");
}

export async function createSessionAction(f: FormData) {
  let id: string;
  try {
    id = (
      await sessions.createSession({
        title: str(f, "title")!,
        description: str(f, "description"),
        topics: str(f, "topics"),
        scheduledAt: str(f, "scheduledAt")!,
      })
    ).id;
  } catch (err) {
    fail("/sessions", err);
  }
  redirect(`/sessions?focus=${id}`);
}

export async function assignMentorAction(sessionId: string, mentorId: string | null) {
  try {
    await sessions.assignMentor(sessionId, mentorId);
  } catch (err) {
    fail(`/sessions?focus=${sessionId}`, err);
  }
  revalidatePath("/sessions");
}

export async function sessionStatusAction(sessionId: string, status: SessionStatus) {
  try {
    await sessions.updateSessionStatus(sessionId, status);
  } catch (err) {
    fail("/sessions", err);
  }
  revalidatePath("/sessions");
}

export async function createStartupAction(f: FormData) {
  let id: string;
  try {
    id = (
      await createStartup({
        name: str(f, "name")!,
        founderName: str(f, "founderName"),
        email: str(f, "email"),
        sector: str(f, "sector"),
        stage: str(f, "stage"),
        needs: str(f, "needs"),
      })
    ).id;
  } catch (err) {
    fail("/startups", err);
  }
  redirect(`/startups?startup=${id}`);
}

export async function createRequestAction(f: FormData) {
  const startupId = str(f, "startupId")!;
  const back = `/startups?startup=${startupId}&topics=${encodeURIComponent(str(f, "topics") ?? "")}`;
  try {
    await requests.createRequest({
      startupId,
      mentorId: str(f, "mentorId")!,
      topic: str(f, "topic")!,
      message: str(f, "message"),
    });
  } catch (err) {
    fail(back, err);
  }
  redirect(`${back}&sent=1`);
}

export async function respondRequestAction(id: string, status: RequestStatus) {
  try {
    await requests.respondToRequest(id, status);
  } catch (err) {
    fail("/requests", err);
  }
  revalidatePath("/requests");
}
