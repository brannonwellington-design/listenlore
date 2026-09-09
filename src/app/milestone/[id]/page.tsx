import Link from "next/link";
import { notFound } from "next/navigation";
import { getTimelineData } from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { MomentCard } from "@/components/timeline/shared";
import AddPhotos from "@/components/AddPhotos";
import { MAX_PHOTOS_PER_MOMENT } from "@/lib/upload";
import s from "@/components/timeline.module.css";

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
  return `${MONTHS[m - 1]} ${y}`;
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
  const [data, viewer] = await Promise.all([getTimelineData(), getViewer()]);

  const milestone = data.milestones.find((ms) => ms.id === id);
  if (!milestone) notFound();

  const date = fmtRange(
    milestone.date_start,
    milestone.date_end,
    milestone.date_precision
  );
  const metaBits = [date, milestone.location, milestone.category].filter(
    Boolean
  );

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
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 40 }}>
        {milestone.media.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.id}
            src={m.url}
            alt={m.caption ?? milestone.title}
            style={{
              width: "100%",
              borderRadius: 8,
              aspectRatio:
                m.width && m.height ? `${m.width} / ${m.height}` : undefined,
            }}
          />
        ))}
      </div>
      {milestone.moments.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontSize: 24, lineHeight: "28px" }}>
            Moments
          </h2>
          <div className={s.momentGrid} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {milestone.moments.map((m) => (
              <div key={m.id}>
                <MomentCard m={m} viewer={viewer} />
                {viewer && (
                  <AddPhotos
                    momentId={m.id}
                    remaining={MAX_PHOTOS_PER_MOMENT - m.media.length}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
