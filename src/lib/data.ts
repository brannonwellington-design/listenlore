import "server-only";
import { serviceClient } from "./supabase/service";
import type {
  DatePrecision,
  MediaItem,
  Milestone,
  Moment,
  TimelineData,
} from "./types";


// A week: long enough that a tab left open across the offsite still
// shows photos; pages re-render fresh URLs on every request anyway.
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

interface MediaRow {
  id: string;
  owner_type: "milestone" | "moment";
  milestone_id: string | null;
  moment_id: string | null;
  storage_path: string;
  caption: string | null;
  sort: number;
  width: number | null;
  height: number | null;
}

export async function getTimelineData(): Promise<TimelineData> {
  const db = serviceClient();

  const [milestonesRes, momentsRes, mediaRes, peopleRes, tagsRes] =
    await Promise.all([
      db
        .from("milestones")
        .select("id, title, blurb, story, date_start, date_end, date_precision, location, published, categories(label)")
        .eq("published", true),
      db
        .from("moments")
        .select("id, title, body, milestone_id, event_date, date_precision, location, created_by, categories(label), author:people!moments_author_person_id_fkey(full_name)"),
      db
        .from("media")
        .select("id, owner_type, milestone_id, moment_id, storage_path, caption, sort, width, height")
        .order("sort"),
      db.from("people").select("id, full_name"),
      db.from("moment_people").select("moment_id, person_id"),
    ]);

  const firstError =
    milestonesRes.error ?? momentsRes.error ?? mediaRes.error ??
    peopleRes.error ?? tagsRes.error;
  if (firstError) throw new Error(`Timeline query failed: ${firstError.message}`);

  const mediaRows = (mediaRes.data ?? []) as MediaRow[];

  // One batch signing call for every storage path.
  const paths = [...new Set(mediaRows.map((m) => m.storage_path))];
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error } = await db.storage
      .from("media")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) throw new Error(`Signing media URLs failed: ${error.message}`);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
    }
  }

  // Group media once instead of filtering the whole list per owner.
  const mediaByOwner = new Map<string, MediaItem[]>();
  for (const m of mediaRows) {
    const ownerId = m.owner_type === "milestone" ? m.milestone_id : m.moment_id;
    const url = signedByPath.get(m.storage_path);
    if (!ownerId || !url) continue;
    const key = `${m.owner_type}:${ownerId}`;
    const list = mediaByOwner.get(key) ?? [];
    list.push({
      id: m.id,
      url,
      caption: m.caption,
      sort: m.sort,
      width: m.width,
      height: m.height,
    });
    mediaByOwner.set(key, list);
  }
  const mediaFor = (kind: "milestone" | "moment", id: string): MediaItem[] =>
    mediaByOwner.get(`${kind}:${id}`) ?? [];

  const personName = new Map(
    (peopleRes.data ?? []).map((p) => [p.id as string, p.full_name as string])
  );
  const tagsByMoment = new Map<string, string[]>();
  for (const t of tagsRes.data ?? []) {
    const name = personName.get(t.person_id as string);
    if (!name) continue;
    const list = tagsByMoment.get(t.moment_id as string) ?? [];
    list.push(name);
    tagsByMoment.set(t.moment_id as string, list);
  }

  type Rel = { label: string } | { label: string }[] | null;
  const relLabel = (rel: Rel): string | null =>
    rel == null ? null : Array.isArray(rel) ? (rel[0]?.label ?? null) : rel.label;
  type PersonRel = { full_name: string } | { full_name: string }[] | null;
  const relName = (rel: PersonRel): string | null =>
    rel == null ? null : Array.isArray(rel) ? (rel[0]?.full_name ?? null) : rel.full_name;

  const moments: Moment[] = (momentsRes.data ?? []).map((m) => ({
    id: m.id as string,
    title: m.title as string,
    body: (m.body as string) ?? null,
    category: relLabel(m.categories as Rel),
    milestone_id: (m.milestone_id as string) ?? null,
    author: relName(m.author as PersonRel),
    tagged: tagsByMoment.get(m.id as string) ?? [],
    event_date: (m.event_date as string) ?? null,
    date_precision: m.date_precision as DatePrecision,
    location: (m.location as string) ?? null,
    created_by: (m.created_by as string) ?? null,
    media: mediaFor("moment", m.id as string),
  }));

  const momentsByMilestone = new Map<string, Moment[]>();
  for (const m of moments) {
    if (!m.milestone_id) continue;
    const list = momentsByMilestone.get(m.milestone_id) ?? [];
    list.push(m);
    momentsByMilestone.set(m.milestone_id, list);
  }
  for (const list of momentsByMilestone.values()) {
    list.sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  }

  const today = new Date().toISOString().slice(0, 10);
  const milestones: Milestone[] = (milestonesRes.data ?? []).map((ms) => ({
    id: ms.id as string,
    title: ms.title as string,
    blurb: (ms.blurb as string) ?? null,
    story: (ms.story as string) ?? null,
    category: relLabel(ms.categories as Rel),
    date_start: (ms.date_start as string) ?? null,
    date_end: (ms.date_end as string) ?? null,
    date_precision: ms.date_precision as DatePrecision,
    location: (ms.location as string) ?? null,
    media: mediaFor("milestone", ms.id as string),
    moments: momentsByMilestone.get(ms.id as string) ?? [],
    upcoming: !!ms.date_start && ms.date_start > today,
  }));

  // Dated first (chronological), undated at the end in title order.
  milestones.sort((a, b) => {
    if (a.date_start && b.date_start) return a.date_start.localeCompare(b.date_start);
    if (a.date_start) return -1;
    if (b.date_start) return 1;
    return a.title.localeCompare(b.title);
  });

  const years = milestones
    .map((m) => m.date_start?.slice(0, 4))
    .filter((y): y is string => !!y);
  const yearRange =
    years.length > 0 ? `${years[0]}–${years[years.length - 1]}` : "";

  return {
    milestones,
    floatingMoments: moments
      .filter((m) => !m.milestone_id)
      .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")),
    counts: { milestones: milestones.length, moments: moments.length },
    yearRange,
  };
}
