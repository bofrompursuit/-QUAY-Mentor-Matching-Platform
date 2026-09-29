import Link from "next/link";
import { listMentors } from "@/lib/services/mentors";
import { Tags, type SP } from "../ui";

export const dynamic = "force-dynamic";

export default async function Mentors({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const mentors = await listMentors({
    q: sp.q || undefined,
    active: sp.status === "active" ? true : sp.status === "inactive" ? false : undefined,
    stale: sp.status === "stale" ? true : undefined,
  });
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Mentor directory ({mentors.length})</h1>
        <Link href="/mentors/new"><button>+ Add mentor</button></Link>
      </div>
      <form className="card row">
        <input name="q" defaultValue={sp.q} placeholder="Search name, company, expertise…" style={{ flex: 1 }} />
        <select name="status" defaultValue={sp.status ?? ""} style={{ width: 160 }}>
          <option value="">All</option><option value="active">Active</option>
          <option value="inactive">Inactive</option><option value="stale">Stale</option>
        </select>
        <button>Filter</button>
      </form>
      <div className="card tbl">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Expertise</th><th>Engagement</th><th>Status</th></tr></thead>
          <tbody>
            {mentors.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/mentors/${m.id}`}>{m.name}</Link><div className="muted">{m.email}</div></td>
                <td>{[m.title, m.company].filter(Boolean).join(" @ ")}</td>
                <td><Tags value={m.expertise} /></td>
                <td>{m._count.sessions} sessions · {m._count.requests} requests</td>
                <td>
                  {!m.active && <span className="pill">inactive</span>} {m.stale && <span className="pill stale">stale</span>}{" "}
                  {m._count.flags > 0 && <span className="pill OPEN">{m._count.flags} flag</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
