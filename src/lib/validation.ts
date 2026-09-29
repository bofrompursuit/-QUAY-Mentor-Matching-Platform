import { z } from "zod";
import { serializeTags } from "./tags";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  // undefined = "not provided" (leave as-is on update); blank = clear the field
  .transform((v) => (v === undefined ? undefined : v || null));

const tags = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v === undefined ? undefined : serializeTags(v)));

export const mentorInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  title: optionalText,
  company: optionalText,
  linkedinUrl: z
    .string()
    .trim()
    .url("Must be a URL")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  bio: optionalText,
  expertise: tags,
  active: z.boolean().optional(),
});
export type MentorInput = z.input<typeof mentorInput>;

export const mentorUpdate = mentorInput.partial();
export type MentorUpdate = z.input<typeof mentorUpdate>;

export const startupInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  founderName: optionalText,
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  sector: optionalText,
  stage: optionalText,
  needs: tags,
});
export type StartupInput = z.input<typeof startupInput>;

export const sessionInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText,
  topics: tags.refine((t) => !!t && t.length > 0, "At least one topic is required"),
  scheduledAt: z.coerce.date({ invalid_type_error: "Valid date is required" }),
  mentorId: z.string().optional().nullable(),
});
export type SessionInput = Omit<z.input<typeof sessionInput>, "scheduledAt"> & { scheduledAt: Date | string };

export const requestInput = z.object({
  startupId: z.string().min(1),
  mentorId: z.string().min(1),
  topic: z.string().trim().min(1, "Topic is required").max(200),
  message: optionalText,
});
export type RequestInput = z.input<typeof requestInput>;

export const REQUEST_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "COMPLETED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SESSION_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const jobChangeWebhook = z.object({
  email: z.string().trim().toLowerCase().email(),
  title: z.string().trim().optional().nullable(),
  company: z.string().trim().optional().nullable(),
  source: z.string().trim().optional(),
});
