import Link from "next/link";
import type { MediaItem, Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";

export interface ViewerInfo {
  userId: string;
  name: string;
  isAdmin: boolean;
}

// Shared editing: any signed-in employee may edit any moment. Deleting one
// (or its photos) remains the poster's and admins' call — see canDelete.
export function canEdit(viewer: ViewerInfo | null): boolean {
  return !!viewer;
}

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function fmtDate(
  ms: Pick<Milestone, "date_start" | "date_end" | "date_precision">
): string {
  if (!ms.date_start) return "Undated";
  const a = parts(ms.date_start);
  if (ms.date_end) {
    const b = parts(ms.date_end);
    if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}`;
    return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}`;
  }
  if (ms.date_precision === "day") return `${MONTHS[a.m - 1]} ${a.d}`;
  if (ms.date_precision === "year") return `${a.y}`;
  return `${MONTHS[a.m - 1]} ${a.y}`;
}

export function fmtMomentDate(m: Moment): string | null {
  if (!m.event_date) return null;
  const a = parts(m.event_date);
  if (m.date_precision === "day") return `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  return `${MONTHS[a.m - 1]} ${a.y}`;
}

export function byline(m: Moment): string {
  const bits: string[] = [];
  if (m.author) bits.push(m.author);
  const others = m.tagged.filter((t) => t !== m.author);
  if (others.length > 0) {
    const shown = others.slice(0, 2);
    const extra = others.length - shown.length;
    bits.push(`with ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`);
  }
  const d = fmtMomentDate(m);
  if (d) bits.push(d);
  if (m.location) bits.push(m.location);
  if (m.media.length > 1) bits.push(`${m.media.length} photos`);
  return bits.join(" · ");
}

// The category chip is the one piece of meta that reads as a mark, not a
// sentence — same treatment on every item in every view.
export function CategoryChip({ label }: { label: string | null }) {
  if (!label) return null;
  return <span className={s.catChip}>{label}</span>;
}

// One linear stream: milestones and free-floating moments share the same
// chronological spine instead of the moments pooling at the bottom.
export type TimelineEntry =
  | { kind: "milestone"; ms: Milestone }
  | { kind: "moment"; m: Moment };

export function groupTimelineByYear(
  data: TimelineData
): [string, TimelineEntry[]][] {
  const dated: { date: string; order: number; entry: TimelineEntry }[] = [];
  for (const ms of data.milestones) {
    if (ms.date_start) {
      dated.push({ date: ms.date_start, order: 0, entry: { kind: "milestone", ms } });
    }
  }
  for (const m of data.floatingMoments) {
    if (m.event_date) {
      dated.push({ date: m.event_date, order: 1, entry: { kind: "moment", m } });
    }
  }
  dated.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const years = new Map<string, TimelineEntry[]>();
  for (const e of dated) {
    const y = e.date.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), e.entry]);
  }
  return [...years.entries()];
}

export function undatedFloating(data: TimelineData): Moment[] {
  return data.floatingMoments.filter((m) => !m.event_date);
}

// Consecutive free-floating moments merge into one cluster so the views keep
// rhythm: milestones get big beats, the chatter between them gets density.
export type ClusteredEntry =
  | { kind: "milestone"; ms: Milestone }
  | { kind: "moments"; moments: Moment[] };

export function clusterEntries(entries: TimelineEntry[]): ClusteredEntry[] {
  const out: ClusteredEntry[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (e.kind === "milestone") {
      out.push({ kind: "milestone", ms: e.ms });
    } else if (last?.kind === "moments") {
      last.moments.push(e.m);
    } else {
      out.push({ kind: "moments", moments: [e.m] });
    }
  }
  return out;
}

// A cluster's date label: one shared label, or the span it covers.
export function clusterDateLabel(moments: Moment[]): string {
  const labels = [...new Set(moments.map((m) => fmtMomentDate(m) ?? "Undated"))];
  if (labels.length === 1) return labels[0];
  return `${labels[0]} – ${labels[labels.length - 1]}`;
}

export function groupByYear(milestones: Milestone[]) {
  const dated = milestones.filter((m) => m.date_start);
  const years = new Map<string, Milestone[]>();
  for (const m of dated) {
    const y = m.date_start!.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), m]);
  }
  return [...years.entries()];
}

// Portrait photos keep their shape instead of being guillotined into
// landscape boxes; extremes are clamped so the grid stays composed.
export function aspect(
  media: MediaItem | undefined,
  min = 3 / 4,
  max = 8 / 5
): string {
  if (!media?.width || !media?.height) return "3 / 2";
  const r = Math.min(Math.max(media.width / media.height, min), max);
  return `${r.toFixed(4)} / 1`;
}

export function EditLink({
  viewer,
  m,
}: {
  viewer: ViewerInfo | null;
  m: Moment;
}) {
  if (!canEdit(viewer)) return null;
  return (
    <Link
      href={`/moment/${m.id}/edit`}
      className={s.editLink}
      onClick={(e) => e.stopPropagation()}
    >
      Edit
    </Link>
  );
}

// The visible slice of a text-only moment's story: the words are the
// payload, so they earn the space a photo would get.
export function excerpt(m: Moment, maxChars = 160): string | null {
  if (m.media.length > 0 || !m.body) return null;
  const text = m.body.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}

// The one card for a moment in a grid: photo or quote up top, then title
// and the full meta line. Used by milestone grids and floating clusters alike.
export function MomentCard({
  m,
  viewer,
}: {
  m: Moment;
  viewer: ViewerInfo | null;
}) {
  const quote = excerpt(m, 220);
  return (
    <div className={s.momentCard} data-moment-id={m.id}>
      {m.media[0] ? (
        <Link href={`/moment/${m.id}`}>
          <img
            className={s.momentCardPhoto}
            style={{ aspectRatio: aspect(m.media[0]) }}
            src={m.media[0].url}
            alt=""
            loading="lazy"
          />
        </Link>
      ) : (
        quote && (
          <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
            <div className={s.quoteBlock}>
              <div className={s.quoteClamp}>{quote}</div>
            </div>
          </Link>
        )
      )}
      <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
        <span className={s.momentCardTitle}>{m.title}</span>
      </Link>
      <div className={s.momentByline}>
        <CategoryChip label={m.category} /> {byline(m)}{" "}
        <EditLink viewer={viewer} m={m} />
      </div>
    </div>
  );
}

export function MomentRow({
  m,
  viewer,
}: {
  m: Moment;
  viewer: ViewerInfo | null;
}) {
  const quote = excerpt(m);
  return (
    <div className={s.momentRow} data-moment-id={m.id}>
      {m.media[0] && (
        <Link href={`/moment/${m.id}`}>
          <img className={s.momentThumb} src={m.media[0].url} alt="" loading="lazy" />
        </Link>
      )}
      <div>
        <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
          <span className={s.momentTitle}>{m.title}</span>
        </Link>
        {quote && (
          <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
            <div className={s.momentExcerpt}>{quote}</div>
          </Link>
        )}
        <div className={s.momentByline}>
          <CategoryChip label={m.category} /> {byline(m)}{" "}
          <EditLink viewer={viewer} m={m} />
        </div>
      </div>
    </div>
  );
}
