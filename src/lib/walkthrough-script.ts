// The walkthrough script and its schedule. Shared by the editor, the
// player and the server, so it must stay free of server-only imports.

export type ScriptView = "grid" | "nodes";

export type ScriptItem =
  | { kind: "stop"; id: string; at: number; text: string }
  | { kind: "view"; view: ScriptView; seconds: number }
  | { kind: "wait"; seconds: number };

export interface WalkthroughScript {
  version: 2;
  audioPath: string | null;
  items: ScriptItem[];
}

export const EMPTY_SCRIPT: WalkthroughScript = { version: 2, audioPath: null, items: [] };

// The opening a fresh script gets: a wander through the Grid, the Nodes
// settling in, then the Timeline.
export const DEFAULT_OPENING: ScriptItem[] = [
  { kind: "view", view: "grid", seconds: 6 },
  { kind: "view", view: "nodes", seconds: 6 },
];

const num = (v: unknown, fallback = 0) =>
  Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : fallback;

// Accepts the current shape, or the first version (a flat list of stops),
// and returns something the player can trust.
export function sanitizeScript(raw: unknown, audioPrefix: string): WalkthroughScript {
  if (!raw || typeof raw !== "object") return EMPTY_SCRIPT;
  const r = raw as { audioPath?: unknown; items?: unknown; stops?: unknown };
  const audioPath =
    typeof r.audioPath === "string" && r.audioPath.startsWith(audioPrefix)
      ? r.audioPath
      : null;
  const source: unknown[] = Array.isArray(r.items)
    ? r.items
    : Array.isArray(r.stops)
      ? r.stops.map((s) => ({ ...(s as object), kind: "stop" }))
      : [];
  const items: ScriptItem[] = [];
  for (const it of source) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (o.kind === "stop" && typeof o.id === "string") {
      items.push({
        kind: "stop",
        id: o.id,
        at: num(o.at),
        text: typeof o.text === "string" ? o.text.slice(0, 2000) : "",
      });
    } else if (o.kind === "view" && (o.view === "grid" || o.view === "nodes")) {
      items.push({ kind: "view", view: o.view, seconds: Math.min(120, num(o.seconds, 6)) });
    } else if (o.kind === "wait") {
      items.push({ kind: "wait", seconds: Math.min(120, num(o.seconds, 3)) });
    }
  }
  return { version: 2, audioPath, items };
}

// ---------------------------------------------------------------------------
// Schedule: absolute seconds for everything the tour does.
// ---------------------------------------------------------------------------

export interface StopInfo {
  index: number;
  id: string;
  at: number;
  text: string;
}

export type Segment =
  | { kind: "view"; view: ScriptView; start: number; end: number }
  | { kind: "travel"; from: number | null; to: number; start: number; end: number }
  | { kind: "focus"; stop: number; start: number; end: number }
  | { kind: "rest"; stop: number | null; start: number; end: number };

export interface Schedule {
  stops: StopInfo[];
  segments: Segment[];
  total: number;
}

const HOLD_SILENT = 8; // seconds on a stop when there is no recording
const TRAVEL_SILENT = 4;
const MIN_HOLD = 2;
const MIN_TRAVEL = 1;
const SCROLL_LEAD = 0.35; // share of a narrated gap spent travelling

type Extra = Exclude<ScriptItem, { kind: "stop" }>;

// Items grouped as: the opening extras, then each stop with the extras
// that follow it.
function group(items: ScriptItem[], known: (id: string) => boolean) {
  const opening: Extra[] = [];
  const stops: { stop: Extract<ScriptItem, { kind: "stop" }>; after: Extra[] }[] = [];
  for (const it of items) {
    if (it.kind === "stop") {
      if (!known(it.id)) continue;
      stops.push({ stop: it, after: [] });
    } else if (stops.length === 0) opening.push(it);
    else stops[stops.length - 1].after.push(it);
  }
  return { opening, stops };
}

// Extras laid end to end from `start`, scaled to fit `budget` seconds.
function layExtras(
  extras: Extra[],
  start: number,
  budget: number,
  stopIndex: number | null,
  out: Segment[]
): number {
  const want = extras.reduce((n, e) => n + e.seconds, 0);
  const scale = want > 0 && budget < want ? Math.max(0, budget) / want : 1;
  let t = start;
  for (const e of extras) {
    const len = e.seconds * scale;
    if (len <= 0) continue;
    if (e.kind === "view") out.push({ kind: "view", view: e.view, start: t, end: t + len });
    else out.push({ kind: "rest", stop: stopIndex, start: t, end: t + len });
    t += len;
  }
  return t;
}

export function buildSchedule(items: ScriptItem[], known: (id: string) => boolean): Schedule {
  const { opening, stops: grouped } = group(items, known);
  const timed = grouped.some((g) => g.stop.at > 0);
  const segments: Segment[] = [];
  const stops: StopInfo[] = [];

  if (!timed) {
    // Silent clock: everything laid end to end.
    let t = layExtras(opening, 0, Infinity, null, segments);
    grouped.forEach((g, i) => {
      const travelEnd = t + TRAVEL_SILENT;
      segments.push({ kind: "travel", from: i === 0 ? null : i - 1, to: i, start: t, end: travelEnd });
      const at = travelEnd;
      stops.push({ index: i, id: g.stop.id, at, text: g.stop.text });
      segments.push({ kind: "focus", stop: i, start: at, end: at + HOLD_SILENT });
      t = layExtras(g.after, at + HOLD_SILENT, Infinity, i, segments);
    });
    return { stops, segments, total: t + 1 };
  }

  // Narrated: each stop begins at its timestamp. The extras after a stop
  // and the travel to the next fit inside that gap; the hold takes what
  // is left, and if there isn't enough the extras give way first.
  let prevAt = -Infinity;
  const ats = grouped.map((g) => {
    const at = Math.max(g.stop.at, prevAt + MIN_HOLD + MIN_TRAVEL);
    prevAt = at;
    return at;
  });
  const openBudget = Math.max(0, ats[0] - MIN_TRAVEL);
  let t = layExtras(opening, 0, openBudget, null, segments);
  segments.push({ kind: "travel", from: null, to: 0, start: t, end: ats[0] });

  grouped.forEach((g, i) => {
    const at = ats[i];
    stops.push({ index: i, id: g.stop.id, at, text: g.stop.text });
    const next = ats[i + 1];
    if (next === undefined) {
      const end = at + HOLD_SILENT;
      segments.push({ kind: "focus", stop: i, start: at, end });
      t = layExtras(g.after, end, Infinity, i, segments);
      return;
    }
    const gap = next - at;
    const extrasWant = g.after.reduce((n, e) => n + e.seconds, 0);
    let travel = Math.max(MIN_TRAVEL, Math.min(gap * SCROLL_LEAD, 6));
    let hold = gap - travel - extrasWant;
    let extrasBudget = extrasWant;
    if (hold < MIN_HOLD) {
      hold = Math.min(MIN_HOLD, Math.max(0, gap - travel));
      extrasBudget = Math.max(0, gap - travel - hold);
      if (extrasBudget === 0 && gap - hold < travel) travel = Math.max(0.5, gap - hold);
    }
    const holdEnd = at + hold;
    segments.push({ kind: "focus", stop: i, start: at, end: holdEnd });
    const extrasEnd = layExtras(g.after, holdEnd, extrasBudget, i, segments);
    segments.push({ kind: "travel", from: i, to: i + 1, start: extrasEnd, end: next });
  });
  return { stops, segments, total: t + 1 };
}

export function segmentAt(schedule: Schedule, time: number): Segment | null {
  for (const seg of schedule.segments) {
    if (time >= seg.start && time < seg.end) return seg;
  }
  return null;
}

export function fmtClock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
export function parseClock(v: string): number {
  const parts = v.trim().split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return 0;
  if (parts.length === 1) return Math.max(0, parts[0]);
  return Math.max(0, parts[0] * 60 + parts[1]);
}
