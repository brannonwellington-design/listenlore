import Link from "next/link";
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase/service";

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

function fmtRange(
  start: string | null,
  end: string | null,
  precision: string
): string | null {
  const from = fmt(start, precision);
  if (!from) return null;
  if (!end || end === start) return from;
  const [, m, d] = end.split("-").map(Number);
  if (precision === "day" && start && start.slice(0, 7) === end.slice(0, 7)) {
    return `${from.replace(/,.*$/, "")}–${d}, ${end.slice(0, 4)}`;
  }
  return `${from} – ${MONTHS[m - 1]} ${d}, ${end.slice(0, 4)}`;
}

export default async function MilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = serviceClient();

  const { data: milestone } = await service
    .from("milestones")
    .select(
      "id, title, blurb, story, date_start, date_end, date_precision, location, published, categories(label)"
    )
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (!milestone) notFound();

  const [momentsRes, mediaRes] = await Promise.all([
    service
      .from("moments")
      .select(
        "id, title, event_date, date_precision, author:people!moments_author_person_id_fkey(full_name)"
      )
      .eq("milestone_id", id)
      .order("event_date", { ascending: true, nullsFirst: false }),
    service
      .from("media")
      .select("id, storage_path, caption, width, height")
      .eq("milestone_id", id)
      .eq("owner_type", "milestone")
      .order("sort"),
  ]);

  const mediaRows = mediaRes.data ?? [];
  const signed = new Map<string, string>();
  if (mediaRows.length > 0) {
    const { data } = await service.storage
      .from("media")
      .createSignedUrls(mediaRows.map((m) => m.storage_path), 60 * 60 * 24);
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  type Rel = { label?: string; full_name?: string };
  const one = (rel: Rel | Rel[] | null): Rel | null =>
    rel == null ? null : Array.isArray(rel) ? (rel[0] ?? null) : rel;

  const category = one(milestone.categories as Rel)?.label ?? null;
  const date = fmtRange(
    milestone.date_start,
    milestone.date_end,
    milestone.date_precision
  );
  const moments = momentsRes.data ?? [];

  const metaBits = [date, milestone.location, category].filter(Boolean);

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 96, maxWidth: 880 }}>
      <Link href="/" style={{ fontSize: 14 }}>
        ← Back to the timeline
      </Link>
      <h1 style={{ fontSize: 48, lineHeight: "52px", marginTop: 32 }}>
        {milestone.title}
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
      </p>
      {milestone.blurb && (
        <p
          style={{
            fontSize: 18,
            lineHeight: "28px",
            color: "var(--content-secondary)",
            marginTop: 24,
            maxWidth: 640,
          }}
        >
          {milestone.blurb}
        </p>
      )}
      {milestone.story && (
        <p
          style={{
            fontSize: 16,
            lineHeight: "24px",
            marginTop: 16,
            maxWidth: 640,
            whiteSpace: "pre-line",
          }}
        >
          {milestone.story}
        </p>
      )}
      {moments.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 24, lineHeight: "28px" }}>
            Moments from this milestone
          </h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "16px 0 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {moments.map((m) => {
              const author = one(m.author as Rel)?.full_name;
              const when = fmt(m.event_date, m.date_precision);
              return (
                <li key={m.id} style={{ fontSize: 16, lineHeight: "24px" }}>
                  <Link
                    href={`/moment/${m.id}`}
                    style={{ color: "var(--content-brand)" }}
                  >
                    {m.title}
                  </Link>
                  {(author || when) && (
                    <span
                      className="num"
                      style={{
                        fontSize: 13,
                        color: "var(--content-secondary)",
                        marginLeft: 8,
                      }}
                    >
                      {[author, when].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
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
              alt={m.caption ?? milestone.title}
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
