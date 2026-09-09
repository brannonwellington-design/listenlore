import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getMilestoneSummary } from "@/lib/data";
import { formOptions } from "@/lib/form-options";
import MomentForm from "@/components/MomentForm";
import s from "@/components/form.module.css";
import { createMoment } from "./actions";

export const dynamic = "force-dynamic";

export default async function AddMomentPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const viewer = await getViewer();
  const { event: eventId } = await searchParams;
  if (!viewer) {
    redirect(`/login?next=${encodeURIComponent(eventId ? `/add?event=${eventId}` : "/add")}`);
  }

  // Arriving from an event page: that event is preselected, and saving
  // returns you to it instead of the timeline.
  const [options, event] = await Promise.all([
    formOptions(),
    eventId ? getMilestoneSummary(eventId) : Promise.resolve(null),
  ]);

  return (
    <div className={`wrap ${s.page}`}>
      <Link
        href={event ? `/event/${event.id}` : "/"}
        className={s.pageBack}
      >
        ← Back to {event ? event.title : "the timeline"}
      </Link>
      <h1 className={s.pageTitle}>Add a Moment</h1>
      <p className={s.pageLead}>
        Posting as {viewer.name}. It goes live right away, and you can edit or
        remove it whenever.
      </p>
      {!event && (
        <p className={s.pageNote}>
          Adding a lot at once?{" "}
          <Link href="/add/bulk">Switch to bulk mode →</Link>
        </p>
      )}
      {event && (
        <div className={s.context}>
          {event.thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.thumb} alt="" className={s.contextThumb} />
          )}
          <div>
            <div className={s.contextKicker}>Adding to</div>
            <div className={s.contextTitle}>{event.title}</div>
            {event.meta && <div className={s.contextMeta}>{event.meta}</div>}
          </div>
          <Link href="/add" className={s.contextClear}>
            Post on its own instead
          </Link>
        </div>
      )}
      <div className={s.pageBody}>
        <MomentForm
          action={createMoment}
          categories={options.categories}
          milestones={options.milestones}
          people={options.people}
          defaults={
            event
              ? {
                  milestone_id: event.id,
                  category_id: event.categoryId ?? undefined,
                  event_date: event.dateStart ?? undefined,
                  location: event.location ?? undefined,
                }
              : {}
          }
          returnTo={event ? `/event/${event.id}` : undefined}
          submitLabel={event ? `Add to ${event.title}` : "Add to the timeline"}
        />
      </div>
    </div>
  );
}
