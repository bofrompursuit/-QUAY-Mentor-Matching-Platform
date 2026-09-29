import { createMentorAction } from "../../actions";
import { Notice, type SP } from "../../ui";
import { MentorFields } from "../form";

export default async function NewMentor({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Add mentor</h1>
      <Notice sp={sp} />
      <form action={createMentorAction} className="card">
        <MentorFields />
        <button>Create mentor</button>
      </form>
      <p className="muted">Tip: teammates can also add mentors from Slack with <code>/add-mentor Name | email | Title @ Company | tags</code>.</p>
    </>
  );
}
