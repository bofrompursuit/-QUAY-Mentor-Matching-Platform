import Link from "next/link";
import { getDashboardMetrics } from "@/lib/services/analytics";
import { Stat } from "./ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const m = await getDashboardMetrics();
  const maxWeek = Math.max(1, ...m.connections.weekly.map((w) => w.requests));
  return (
    <>
      <h1>Program dashboard</h1>
      <h2>Connections</h2>
      <div className="grid">
        <Stat label="Total requests" value={m.connections.totalRequests} hint={`${m.connections.last30Days} in last 30 days`} />
        <Stat label="Acceptance rate" value={m.connections.acceptanceRate != null ? `${m.connections.acceptanceRate}%` : null} />
        <Stat label="Median response" value={m.connections.medianResponseHours != null ? `${m.connections.medianResponseHours}h` : null} />
        <Stat label="Pending requests" value={m.connections.byStatus.PENDING} />
        <Stat label="Upcoming sessions" value={m.sessions.upcoming} hint={`${m.sessions.upcomingUnassigned} need a mentor`} />
        <Stat label="Sessions completed" value={m.sessions.completed} hint={`${m.sessions.completedLast30Days} in last 30 days`} />
      </div>
      <h2>Mentor network health</h2>
      <div className="grid">
        <Stat label="Active mentors" value={`${m.network.activeMentors} / ${m.network.totalMentors}`} hint={`${m.network.addedLast30Days} added in 30 days`} />
        <Stat label="Engaged (90 days)" value={m.network.engagedLast90Days} />
        <Stat label="Mentor response rate" value={m.network.responseRate != null ? `${m.network.responseRate}%` : null} />
        <Stat label="Stale records" value={m.network.staleMentors} hint={m.network.stalePercent != null ? `${m.network.stalePercent}% of active` : undefined} />
        <Stat label="Median days since verified" value={m.network.medianDaysSinceVerified} />
        <Stat label="Open data flags" value={<Link href="/flags">{m.network.openFlags}</Link>} />
      </div>
      <div className="two">
        <div className="card">
          <h2>Requests per week</h2>
          <table><tbody>
            {m.connections.weekly.map((w) => (
              <tr key={w.weekStart}>
                <td className="muted" style={{ width: 100 }}>{w.weekStart}</td>
                <td><div className="bar" style={{ width: `${(w.requests / maxWeek) * 100}%`, minWidth: w.requests ? 4 : 0 }} /></td>
                <td style={{ width: 90 }}>{w.requests} ({w.accepted} acc.)</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Topic demand vs. mentor supply</h2>
          <table>
            <thead><tr><th>Topic</th><th>Requests</th><th>Mentors</th></tr></thead>
            <tbody>
              {m.topicDemand.map((t) => (
                <tr key={t.topic}><td>{t.topic}</td><td>{t.requests}</td><td className={t.mentors < 2 ? "pill stale" : ""}>{t.mentors}</td></tr>
              ))}
            </tbody>
          </table>
          {!m.topicDemand.length && <p className="muted">No requests yet.</p>}
        </div>
        <div className="card">
          <h2>Most engaged mentors</h2>
          <table><tbody>
            {m.topMentors.map((t) => (
              <tr key={t.id}><td><Link href={`/mentors/${t.id}`}>{t.name}</Link></td><td>{t.engagements} engagements</td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Mentors by intake source</h2>
          <table><tbody>
            {Object.entries(m.network.bySource).map(([s, n]) => <tr key={s}><td>{s}</td><td>{n}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </>
  );
}
