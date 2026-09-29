import Link from "next/link";
import { describeFlag, listOpenFlags, parseRoleChange } from "@/lib/services/mentors";
import { resolveFlagAction, scanStaleAction } from "../actions";
import { fmtDate, Notice, type SP } from "../ui";

export const dynamic = "force-dynamic";

export default async function Flags({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const flags = await listOpenFlags();
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Data health: open flags ({flags.length})</h1>
        <form action={scanStaleAction}><button className="ghost">Scan for stale records</button></form>
      </div>
      <Notice sp={sp} />
      <p className="muted">
        Flags come from teammates, the daily stale scan (<code>/api/flags/scan</code>), and enrichment-provider webhooks
        (<code>POST /api/webhooks/job-change</code>). LinkedIn isn't scraped.
      </p>
      <div className="card tbl">
        <table>
          <thead><tr><th>Mentor</th><th>Reason</th><th>Details</th><th>Source</th><th>Raised</th><th></th></tr></thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id}>
                <td><Link href={`/mentors/${f.mentor.id}`}>{f.mentor.name}</Link></td>
                <td>{f.reason}</td>
                <td>{describeFlag(f)}</td>
                <td>{f.source}</td>
                <td>{fmtDate(f.createdAt)}</td>
                <td className="row">
                  {parseRoleChange(f.details) && (
                    <form action={resolveFlagAction.bind(null, f.id, true, "/flags")} className="inline"><button>Apply</button></form>
                  )}
                  <form action={resolveFlagAction.bind(null, f.id, false, "/flags")} className="inline"><button className="ghost">Dismiss</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!flags.length && <p className="muted">All mentor records look healthy.</p>}
      </div>
    </>
  );
}
