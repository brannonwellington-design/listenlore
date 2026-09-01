import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import MomentForm from "@/components/MomentForm";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { updateMoment, deleteMedia, deleteMoment } from "@/app/add/actions";

export const dynamic = "force-dynamic";

export default async function EditMomentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/moment/${id}/edit`);

  const service = serviceClient();

  const [{ data: moment }, categories, milestones, people, tags, media] =
    await Promise.all([
      service.from("moments").select("*").eq("id", id).maybeSingle(),
      service.from("categories").select("id, label").order("sort"),
      service.from("milestones").select("id, title, date_start").order("date_start", { ascending: true, nullsFirst: false }),
      service.from("people").select("id, full_name").order("full_name"),
      service.from("moment_people").select("person_id").eq("moment_id", id),
      service.from("media").select("id, storage_path").eq("moment_id", id).order("sort"),
    ]);

  if (!moment) redirect("/");
  if (!viewer.isAdmin && moment.created_by !== viewer.userId) redirect("/");

  const signedThumbs = new Map<string, string>();
  const mediaRows = media.data ?? [];
  if (mediaRows.length > 0) {
    const { data: signed } = await service.storage
      .from("media")
      .createSignedUrls(mediaRows.map((m) => m.storage_path), 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedThumbs.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <Link href="/" style={{ fontSize: 14 }}>
        ← Back to the timeline
      </Link>
      <h1 style={{ fontSize: 48, lineHeight: "52px", marginTop: 24 }}>
        Edit Moment
      </h1>
      <div style={{ margin: "16px 0 40px 0" }}>
        {mediaRows.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            {mediaRows.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {signedThumbs.get(m.storage_path) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedThumbs.get(m.storage_path)}
                    alt=""
                    style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 4 }}
                  />
                )}
                <form action={deleteMedia}>
                  <input type="hidden" name="media_id" value={m.id} />
                  <button type="submit" style={{ fontSize: 12, color: "#B82214" }}>
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
      <MomentForm
        action={updateMoment}
        categories={(categories.data ?? []).map((c) => ({ id: c.id, label: c.label }))}
        milestones={(milestones.data ?? []).map((m) => ({
          id: m.id,
          label: m.date_start ? `${m.title} (${m.date_start.slice(0, 7)})` : m.title,
        }))}
        people={(people.data ?? []).map((p) => ({ id: p.id, label: p.full_name }))}
        defaults={{
          moment_id: id,
          title: moment.title,
          body: moment.body ?? undefined,
          category_id: moment.category_id ?? undefined,
          milestone_id: moment.milestone_id ?? undefined,
          event_date: moment.event_date ?? undefined,
          date_precision: moment.date_precision,
          location: moment.location ?? undefined,
          tagged: (tags.data ?? []).map((t) => t.person_id),
        }}
        submitLabel="Save changes"
      />
      <form
        action={deleteMoment}
        style={{ marginTop: 48, borderTop: "1px solid var(--surface-tertiary)", paddingTop: 24 }}
      >
        <input type="hidden" name="moment_id" value={id} />
        <ConfirmSubmit
          message="Delete this moment and its photos for good? This can’t be undone."
          style={{ fontSize: 14, color: "#B82214" }}
        >
          Delete this moment permanently
        </ConfirmSubmit>
      </form>
    </div>
  );
}
