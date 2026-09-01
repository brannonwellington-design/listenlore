import Link from "next/link";
import type { MediaItem, Milestone, Moment } from "@/lib/types";
import s from "../timeline.module.css";

export interface ViewerInfo {
  userId: string;
  name: string;
  isAdmin: boolean;
}

export function canEdit(viewer: ViewerInfo | null, m: Moment): boolean {
  return !!viewer && (viewer.isAdmin || m.created_by === viewer.userId);
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
  if (m.media.length > 1) bits.push(`${m.media.length} photos`);
  return bits.join(" · ");
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
  if (!canEdit(viewer, m)) return null;
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

export function MomentRow({
  m,
  viewer,
}: {
  m: Moment;
  viewer: ViewerInfo | null;
}) {
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
        <div className={s.momentByline}>
          {byline(m)} <EditLink viewer={viewer} m={m} />
        </div>
      </div>
    </div>
  );
}
