import Link from "next/link";
import { notFound } from "next/navigation";
import AddPhotos from "@/components/AddPhotos";
import { getViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { MAX_PHOTOS_PER_MOMENT } from "@/lib/upload";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmt(date: string | null, precision: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (precision === "day") return `${MONTHS[m - 1]} ${d}, ${y}`;
  if (precision === "year") return `${y}`;
  return `${MONTHS[m - 1]} ${y}${precision === "approx" ? " ≈" : ""}`;
}

export default async function MomentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();

  const service = serviceClient();

  const { data: moment } = await service
    .from("moments")
    .select(
      "id, title, body, event_date, date_precision, location, created_by, categories(label), milestones(id, title), author:people!moments_author_person_id_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!moment) notFound();

  const [tags, media] = await Promise.all([
    service
      .from("moment_people")
      .select("people(full_name)")
      .eq("moment_id", id),
    service
      .from("media")
      .select("id, storage_path, caption, width, height")
      .eq("moment_id", id)
      .order("sort"),
  ]);

  const mediaRows = media.data ?? [];
  const signed = new Map<string, string>();
  if (mediaRows.length > 0) {
    const { data } = await service.storage
      .from("media")
      .createSignedUrls(mediaRows.map((m) => m.storage_path), 60 * 60 * 24);
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  type Rel = { label?: string; title?: string; id?: string; full_name?: string };
  const one = (rel: Rel | Rel[] | null): Rel | null =>
    rel == null ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel;

  const author = one(moment.author as Rel)?.full_name ?? null;
  const category = one(moment.categories as Rel)?.label ?? null;
  const milestone = one(moment.milestones as Rel);
  const tagged = (tags.data ?? [])
    .map((t) => one(t.people as Rel)?.full_name)
    .filter((n): n is string => !!n && n !== author);
  const date = fmt(moment.event_date, moment.date_precision);
  const canEdit = !!viewer;

  const metaBits = [
    author,
    tagged.length > 0 ? `with ${tagged.join(", ")}` : null,
    date,
    moment.location,
    category,
  ].filter(Boolean);

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 96, maxWidth: 880 }}>
      <Link href="/" style={{ fontSize: 14 }}>
        ← Back to the timeline
      </Link>
      <h1 style={{ fontSize: 48, lineHeight: "52px", marginTop: 32 }}>
        {moment.title}
      </h1>
      <p
        className="num"
        style={{
          fontSize: 14,
          lineHeight: "20px",
          color: "var(--content-secondary)",
          marginTop: 12,
        }}
      >
        {metaBits.join(" · ")}
        {canEdit && (
          <>
            {" · "}
            <Link href={`/moment/${id}/edit`}>Edit</Link>
          </>
        )}
      </p>
      {milestone && (
        <p style={{ fontSize: 14, lineHeight: "20px", marginTop: 8 }}>
          Part of{" "}
          <Link href="/?view=register" style={{ color: "var(--content-brand)" }}>
            {milestone.title}
          </Link>
        </p>
      )}
      {moment.body && (
        <p
          style={{
            fontSize: 18,
            lineHeight: "28px",
            color: "var(--content-secondary)",
            marginTop: 24,
            maxWidth: 640,
            whiteSpace: "pre-line",
          }}
        >
          {moment.body}
        </p>
      )}
      {canEdit && (
        <div style={{ marginTop: 24 }}>
          <AddPhotos
            momentId={id}
            remaining={MAX_PHOTOS_PER_MOMENT - mediaRows.length}
          />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 40 }}>
        {mediaRows.map((m) => {
          const url = signed.get(m.storage_path);
          if (!url) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={url}
              alt={m.caption ?? moment.title}
              style={{
                width: "100%",
                borderRadius: 8,
                aspectRatio:
                  m.width && m.height ? `${m.width} / ${m.height}` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
