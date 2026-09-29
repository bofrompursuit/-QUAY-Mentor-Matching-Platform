import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ZodError) {
    return Response.json({ error: "Invalid input", details: err.flatten().fieldErrors }, { status: 400 });
  }
  if (err instanceof AppError) {
    return Response.json({ error: err.message, details: err.details }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** Human-readable message for server actions / forms. */
export function errorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return Object.entries(err.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(", ")}`)
      .join("; ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
