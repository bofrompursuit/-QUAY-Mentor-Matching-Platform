import { parseTags } from "@/lib/tags";

export type SP = Promise<Record<string, string | undefined>>;

export function Tags({ value }: { value: string | null | undefined }) {
  return <>{parseTags(value).map((t) => <span key={t} className="tag">{t}</span>)}</>;
}

export function Notice({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.error) return <div className="err">{sp.error}</div>;
  if (sp.saved || sp.sent) return <div className="ok">{sp.sent ? "Request sent." : "Saved."}</div>;
  return null;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card stat">
      <div className="l">{label}</div>
      <div className="v">{value ?? "—"}</div>
      {hint && <div className="muted" style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

export const fmtDate = (d: Date) => d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
