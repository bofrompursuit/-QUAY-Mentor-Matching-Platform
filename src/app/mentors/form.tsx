type M = { name?: string; email?: string; title?: string | null; company?: string | null; linkedinUrl?: string | null; expertise?: string; bio?: string | null; active?: boolean };

export function MentorFields({ m = {}, showActive }: { m?: M; showActive?: boolean }) {
  return (
    <div className="two" style={{ gap: 0, columnGap: 16 }}>
      <label>Name *<input name="name" required defaultValue={m.name} /></label>
      <label>Email *<input name="email" type="email" required defaultValue={m.email} /></label>
      <label>Title<input name="title" defaultValue={m.title ?? ""} /></label>
      <label>Company<input name="company" defaultValue={m.company ?? ""} /></label>
      <label>LinkedIn URL<input name="linkedinUrl" defaultValue={m.linkedinUrl ?? ""} /></label>
      <label>Expertise (comma-separated)<input name="expertise" defaultValue={m.expertise ?? ""} placeholder="fundraising, b2b saas, hiring" /></label>
      <label style={{ gridColumn: "1/-1" }}>Bio<textarea name="bio" rows={3} defaultValue={m.bio ?? ""} /></label>
      {showActive && (
        <label className="row"><input type="checkbox" name="active" defaultChecked={m.active} style={{ width: "auto" }} /> Active (available for matching)</label>
      )}
    </div>
  );
}
