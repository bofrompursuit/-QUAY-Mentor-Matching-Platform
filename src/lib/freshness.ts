const DAY_MS = 24 * 60 * 60 * 1000;

export function staleAfterDays(): number {
  const n = Number(process.env.STALE_AFTER_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

export function daysSince(date: Date, now = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

export function isStale(lastVerifiedAt: Date, now = new Date(), days = staleAfterDays()): boolean {
  return daysSince(lastVerifiedAt, now) >= days;
}

export interface Role {
  title?: string | null;
  company?: string | null;
}

function norm(s?: string | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * True when the incoming role differs from the stored one. Blank incoming
 * values mean "unknown", not "left the job", so they never count as a change.
 */
export function detectRoleChange(current: Role, incoming: Role): boolean {
  const companyChanged = !!norm(incoming.company) && norm(incoming.company) !== norm(current.company);
  const titleChanged = !!norm(incoming.title) && norm(incoming.title) !== norm(current.title);
  return companyChanged || titleChanged;
}

export function describeRole(r: Role): string {
  if (r.title && r.company) return `${r.title} @ ${r.company}`;
  return r.title || r.company || "unknown role";
}
