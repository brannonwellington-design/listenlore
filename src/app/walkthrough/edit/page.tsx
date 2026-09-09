import Link from "next/link";
import { redirect } from "next/navigation";
import WalkthroughEditor from "@/components/walkthrough/WalkthroughEditor";
import s from "@/components/form.module.css";
import { getViewer } from "@/lib/auth";
import { getTimelineData } from "@/lib/data";
import { getWalkthrough } from "@/lib/walkthrough";

export const dynamic = "force-dynamic";

// Shape the tour: which events it stops on, when in the narration each
// begins, and what is said there.
export default async function EditWalkthroughPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/walkthrough/edit");

  const [data, script] = await Promise.all([getTimelineData(), getWalkthrough()]);
  const events = data.milestones
    .filter((ms) => ms.date_start)
    .map((ms) => ({
      id: ms.id,
      title: ms.title,
      when: ms.date_start ?? "",
      thumb:
        (ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0])?.url ??
        null,
      moments: ms.moments.length,
    }));

  return (
    <div className={`wrap ${s.page}`} style={{ maxWidth: "calc(880px + 2 * var(--margin))" }}>
      <Link href="/?view=timeline" className={s.pageBack}>
        ← Back to the timeline
      </Link>
      <h1 className={s.pageTitle}>Walkthrough script</h1>
      <p className={s.pageLead}>
        Tick the events the tour should stop on, write what is said at each,
        and mark where in the recording each one begins. Everyone signed in
        can edit this.
      </p>
      <div className={s.pageBody}>
        <WalkthroughEditor events={events} script={script} />
      </div>
    </div>
  );
}
