import Link from "next/link";
import { listStartups } from "@/lib/services/startups";
import { recommendMentorsForStartup } from "@/lib/services/requests";
import { createRequestAction, createStartupAction } from "../actions";
import { Notice, Tags, type SP } from "../ui";

export const dynamic = "force-dynamic";

export default async function Startups({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const startups = await listStartups();
  const startup = startups.find((s) => s.id === sp.startup) ?? startups[0];
  const rec = startup ? await recommendMentorsForStartup(startup.id, { topics: sp.topics || undefined }) : null;
  return (
    <>
      <h1>Find a mentor</h1>
      <Notice sp={sp} />
      <form className="card row">
        <select name="startup" defaultValue={startup?.id} style={{ width: 220 }}>
          {startups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input name="topics" defaultValue={sp.topics} placeholder={`Topics (default: ${startup?.needs || "startup needs"})`} style={{ flex: 1 }} />
        <button>Find mentors</button>
      </form>
      {startup && rec && (
        <div className="card">
          <h2>Recommended for {startup.name} <span className="muted">— {startup.stage} {startup.sector}</span></h2>
          <div style={{ marginBottom: 8 }}>Matching on: <Tags value={rec.topics.join(",")} /></div>
          {!rec.results.length && <p className="muted">No mentors match these topics yet.</p>}
          {rec.results.map((r) => (
            <div key={r.mentorId} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
              <div><span className="score">{r.score}</span> · <b>{r.name}</b> <span className="muted">{[r.title, r.company].filter(Boolean).join(" @ ")}</span></div>
              <div className="muted" style={{ fontSize: 12 }}>{r.reasons.join(" · ")}</div>
              {r.alreadyRequested ? (
                <span className="pill PENDING">request open</span>
              ) : (
                <form action={createRequestAction} className="row" style={{ marginTop: 6 }}>
                  <input type="hidden" name="startupId" value={startup.id} />
                  <input type="hidden" name="mentorId" value={r.mentorId} />
                  <input type="hidden" name="topics" value={sp.topics ?? ""} />
                  <input name="topic" required defaultValue={r.matchedTopics.join(", ")} style={{ width: 200 }} />
                  <input name="message" placeholder="What do you need help with?" style={{ flex: 1 }} />
                  <button>Request intro</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="two">
        <div className="card">
          <h2>Cohort startups</h2>
          <table><tbody>
            {startups.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/startups?startup=${s.id}`}>{s.name}</Link></td>
                <td><Tags value={s.needs} /></td>
                <td><Link href={`/requests?startupId=${s.id}`}>{s._count.requests} requests</Link></td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <form action={createStartupAction} className="card">
          <h2>Add startup</h2>
          <label>Name *<input name="name" required /></label>
          <label>Founder<input name="founderName" /></label>
          <label>Email<input name="email" type="email" /></label>
          <div className="row"><label style={{ flex: 1 }}>Sector<input name="sector" /></label><label style={{ flex: 1 }}>Stage<input name="stage" placeholder="Pre-seed" /></label></div>
          <label>Needs (comma-separated)<input name="needs" placeholder="fundraising, hiring" /></label>
          <button>Add startup</button>
        </form>
      </div>
    </>
  );
}
