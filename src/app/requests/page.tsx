import Link from "next/link";
import { listRequests } from "@/lib/services/requests";
import { respondRequestAction } from "../actions";
import { fmtDate, Notice, type SP } from "../ui";

export const dynamic = "force-dynamic";

export default async function Requests({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const requests = await listRequests({ status: sp.status || undefined, mentorId: sp.mentorId, startupId: sp.startupId });
  return (
    <>
      <h1>Request inbox</h1>
      <Notice sp={sp} />
      <div className="row" style={{ marginBottom: 12 }}>
        {["", "PENDING", "ACCEPTED", "COMPLETED", "DECLINED"].map((s) => (
          <Link key={s} href={s ? `/requests?status=${s}` : "/requests"}><span className={`pill ${s}`}>{s || "ALL"}</span></Link>
        ))}
      </div>
      <div className="card tbl">
        <table>
          <thead><tr><th>Created</th><th>Startup</th><th>Mentor</th><th>Topic</th><th>Match</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.createdAt)}</td>
                <td>{r.startup.name}</td>
                <td><Link href={`/mentors/${r.mentor.id}`}>{r.mentor.name}</Link></td>
                <td>{r.topic}{r.message && <div className="muted">“{r.message}”</div>}</td>
                <td>{r.matchScore ?? "—"}</td>
                <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td className="row">
                  {r.status === "PENDING" && (<>
                    <form action={respondRequestAction.bind(null, r.id, "ACCEPTED")} className="inline"><button>Accept</button></form>
                    <form action={respondRequestAction.bind(null, r.id, "DECLINED")} className="inline"><button className="danger">Decline</button></form>
                  </>)}
                  {r.status === "ACCEPTED" && (
                    <form action={respondRequestAction.bind(null, r.id, "COMPLETED")} className="inline"><button className="ghost">Mark met</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!requests.length && <p className="muted">No requests.</p>}
      </div>
    </>
  );
}
