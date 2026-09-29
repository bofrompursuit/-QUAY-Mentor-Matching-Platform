import Link from "next/link";
import { listSessions, suggestMentorsForSession } from "@/lib/services/sessions";
import { assignMentorAction, createSessionAction, sessionStatusAction } from "../actions";
import { fmtDate, Notice, Tags, type SP } from "../ui";

export const dynamic = "force-dynamic";

export default async function Sessions({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sessions = await listSessions();
  const focus = sessions.find((s) => s.id === sp.focus) ?? sessions.find((s) => s.status === "SCHEDULED" && !s.mentorId);
  const suggestions = focus ? await suggestMentorsForSession(focus.id) : [];
  return (
    <>
      <h1>Curriculum sessions</h1>
      <Notice sp={sp} />
      <div className="two">
        <form action={createSessionAction} className="card">
          <h2>Schedule a session</h2>
          <label>Title *<input name="title" required placeholder="Pricing your first enterprise deal" /></label>
          <label>Topics * (comma-separated)<input name="topics" required placeholder="pricing, enterprise sales" /></label>
          <label>Date & time *<input name="scheduledAt" type="datetime-local" required /></label>
          <label>Description<textarea name="description" rows={2} /></label>
          <button>Create & suggest mentors</button>
        </form>
        <div className="card">
          <h2>Suggested mentors {focus && <>for “{focus.title}”</>}</h2>
          {!focus && <p className="muted">Select a session to see suggestions.</p>}
          {focus && !suggestions.length && <p className="muted">No available mentors match these topics.</p>}
          {focus && suggestions.map((s) => (
            <div key={s.mentorId} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span><span className="score">{s.score}</span> · <Link href={`/mentors/${s.mentorId}`}>{s.name}</Link> <span className="muted">{[s.title, s.company].filter(Boolean).join(" @ ")}</span></span>
                <form action={assignMentorAction.bind(null, focus.id, s.mentorId)} className="inline">
                  <button className={focus.mentorId === s.mentorId ? "ghost" : ""} disabled={focus.mentorId === s.mentorId}>
                    {focus.mentorId === s.mentorId ? "Assigned" : "Assign"}
                  </button>
                </form>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{s.reasons.join(" · ")}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card tbl">
        <table>
          <thead><tr><th>When</th><th>Session</th><th>Topics</th><th>Mentor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={s.id === focus?.id ? { background: "#f0f4ff" } : undefined}>
                <td>{fmtDate(s.scheduledAt)}</td>
                <td><Link href={`/sessions?focus=${s.id}`}>{s.title}</Link></td>
                <td><Tags value={s.topics} /></td>
                <td>{s.mentor ? <Link href={`/mentors/${s.mentor.id}`}>{s.mentor.name}</Link> : <span className="pill OPEN">unassigned</span>}</td>
                <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                <td className="row">
                  {s.status === "SCHEDULED" && s.mentorId && (
                    <form action={sessionStatusAction.bind(null, s.id, "COMPLETED")} className="inline"><button className="ghost">Complete</button></form>
                  )}
                  {s.status === "SCHEDULED" && (
                    <form action={sessionStatusAction.bind(null, s.id, "CANCELLED")} className="inline"><button className="danger">Cancel</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
