import Link from "next/link";
import { notFound } from "next/navigation";
import { daysSince, isStale } from "@/lib/freshness";
import { describeFlag, getMentor, parseRoleChange } from "@/lib/services/mentors";
import { NotFoundError } from "@/lib/errors";
import { deleteMentorAction, flagMentorAction, resolveFlagAction, updateMentorAction, verifyMentorAction } from "../../actions";
import { fmtDate, Notice, type SP } from "../../ui";
import { MentorFields } from "../form";

export const dynamic = "force-dynamic";

export default async function MentorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await getMentor(id).catch((e) => (e instanceof NotFoundError ? notFound() : Promise.reject(e)));
  const stale = isStale(m.lastVerifiedAt);
  const back = `/mentors/${id}`;
  return (
    <>
      <h1>{m.name} {stale && <span className="pill stale">stale</span>}</h1>
      <Notice sp={sp} />
      <div className="card row" style={{ justifyContent: "space-between" }}>
        <span className="muted">
          Source: {m.source} · Last verified {daysSince(m.lastVerifiedAt)} days ago ({fmtDate(m.lastVerifiedAt)})
        </span>
        <span className="row">
          <form action={verifyMentorAction.bind(null, id)} className="inline"><button className="ghost">Mark verified</button></form>
          <form action={deleteMentorAction.bind(null, id)} className="inline"><button className="danger">Delete</button></form>
        </span>
      </div>
      <div className="two">
        <form action={updateMentorAction.bind(null, id)} className="card">
          <h2>Profile</h2>
          <MentorFields m={m} showActive />
          <button>Save changes</button>
        </form>
        <div>
          <div className="card">
            <h2>Data freshness flags</h2>
            {m.flags.length === 0 && <p className="muted">No flags.</p>}
            {m.flags.map((f) => (
              <div key={f.id} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
                <span className={`pill ${f.status}`}>{f.status}</span> <b>{f.reason}</b> <span className="muted">via {f.source}</span>
                <div>{describeFlag(f)}</div>
                {f.status === "OPEN" && (
                  <div className="row">
                    {parseRoleChange(f.details) && (
                      <form action={resolveFlagAction.bind(null, f.id, true, back)} className="inline"><button>Apply change</button></form>
                    )}
                    <form action={resolveFlagAction.bind(null, f.id, false, back)} className="inline"><button className="ghost">Dismiss</button></form>
                  </div>
                )}
              </div>
            ))}
            <form action={flagMentorAction.bind(null, id)} className="row" style={{ marginTop: 10 }}>
              <input name="details" placeholder="e.g. Heard they left Stripe" style={{ flex: 1 }} />
              <button className="ghost">Flag job change</button>
            </form>
          </div>
          <div className="card">
            <h2>Sessions ({m.sessions.length})</h2>
            {m.sessions.map((s) => <div key={s.id}>{fmtDate(s.scheduledAt)} — {s.title} <span className={`pill ${s.status}`}>{s.status}</span></div>)}
          </div>
          <div className="card">
            <h2>Startup requests ({m.requests.length})</h2>
            {m.requests.map((r) => <div key={r.id}>{r.startup.name}: {r.topic} <span className={`pill ${r.status}`}>{r.status}</span></div>)}
            <Link href={`/requests?mentorId=${id}`}>Open in inbox →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
