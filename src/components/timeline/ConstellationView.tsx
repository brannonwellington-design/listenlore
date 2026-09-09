"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import { byline, CategoryChip, fmtDate } from "./shared";

const W = 1280;
const H = 720;
const PAD = 96;

interface Node {
  id: string;
  kind: "milestone" | "moment" | "person";
  floating?: boolean;
  x: number;
  y: number;
  ax: number; // time anchor
  ay: number;
  r: number;
  label: string;
  img?: string;
  upcoming?: boolean;
  milestone?: Milestone;
  moment?: Moment;
  personMoments?: Moment[];
  personAuthored?: Moment[];
  year?: string;
}

interface Edge {
  from: string;
  to: string;
  // Authored ("uploaded by") ties render as faint dotted lines and sit out
  // of the spring simulation, so a prolific poster doesn't drag the whole
  // layout toward themselves.
  soft?: boolean;
}

// Deterministic pseudo-random so the sky looks the same on every visit.
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayNumber(date: string): number {
  return Date.parse(date) / 86400000;
}

function buildSky(data: TimelineData): { nodes: Node[]; edges: Edge[] } {
  const rand = mulberry(7);
  const dated = data.milestones.filter((m) => m.date_start);
  const undated = data.milestones.filter(
    (m) => !m.date_start && m.moments.length > 0
  );

  const days = dated.map((m) => dayNumber(m.date_start!));
  const min = Math.min(...days);
  const max = Math.max(...days);
  const span = Math.max(max - min, 1);
  // Dated milestones spread across time; undated ones get the far right.
  const timeX = (d: string | null): number =>
    d
      ? PAD + ((dayNumber(d) - min) / span) * (W - PAD * 2 - 160)
      : W - PAD - 60;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  [...dated, ...undated].forEach((ms, i) => {
    const ax = timeX(ms.date_start);
    const ay = H / 2 + (i % 2 === 0 ? -1 : 1) * (60 + rand() * 90);
    nodes.push({
      id: ms.id,
      kind: "milestone",
      x: ax + (rand() - 0.5) * 40,
      y: ay,
      ax,
      ay,
      r: Math.min(16 + ms.moments.length * 3, 30),
      label: ms.title,
      upcoming: ms.upcoming,
      milestone: ms,
      year: ms.date_start?.slice(0, 4),
    });
    ms.moments.forEach((mo) => {
      const a = rand() * Math.PI * 2;
      const d = 60 + rand() * 50;
      nodes.push({
        id: mo.id,
        kind: "moment",
        x: ax + Math.cos(a) * d,
        y: ay + Math.sin(a) * d,
        ax,
        ay,
        r: 11,
        label: mo.title,
        img: mo.media[0]?.url,
        moment: mo,
        year: ms.date_start?.slice(0, 4) ?? mo.event_date?.slice(0, 4),
      });
      edges.push({ from: ms.id, to: mo.id });
    });
  });

  // Floating moments drift along the bottom at their own dates.
  data.floatingMoments.forEach((mo) => {
    const ax = timeX(mo.event_date);
    const ay = H - 90 + (rand() - 0.5) * 44;
    nodes.push({
      id: mo.id,
      kind: "moment",
      x: ax + (rand() - 0.5) * 60,
      y: ay,
      ax,
      ay,
      r: 11,
      label: mo.title,
      img: mo.media[0]?.url,
      moment: mo,
      floating: true,
      year: mo.event_date?.slice(0, 4),
    });
  });

  // People are nodes too: connected to moments they're tagged in (dashed)
  // and moments they posted (faint dotted). Node size grows with how much
  // of the archive they've contributed, so the big uploaders are visible
  // at a glance.
  interface PersonAgg {
    name: string;
    taggedNodes: Node[];
    tagged: Moment[];
    authoredNodes: Node[];
    authored: Moment[];
  }
  const byPerson = new Map<string, PersonAgg>();
  const agg = (name: string): PersonAgg => {
    const entry =
      byPerson.get(name) ??
      { name, taggedNodes: [], tagged: [], authoredNodes: [], authored: [] };
    byPerson.set(name, entry);
    return entry;
  };
  for (const n of nodes) {
    if (n.kind !== "moment" || !n.moment) continue;
    for (const name of n.moment.tagged) {
      const entry = agg(name);
      entry.taggedNodes.push(n);
      entry.tagged.push(n.moment);
    }
    if (n.moment.author) {
      const entry = agg(n.moment.author);
      entry.authoredNodes.push(n);
      entry.authored.push(n.moment);
    }
  }
  for (const p of byPerson.values()) {
    const connected = [...p.taggedNodes, ...p.authoredNodes];
    const ax = connected.reduce((sum, n) => sum + n.ax, 0) / connected.length;
    const ay = connected.reduce((sum, n) => sum + n.ay, 0) / connected.length;
    const id = `person:${p.name}`;
    nodes.push({
      id,
      kind: "person",
      x: ax + (rand() - 0.5) * 80,
      y: ay + (rand() - 0.5) * 80,
      ax,
      ay,
      r: Math.min(12 + (p.authored.length + p.tagged.length) * 0.5, 22),
      label: p.name,
      personMoments: p.tagged,
      personAuthored: p.authored,
    });
    const taggedIds = new Set(p.taggedNodes.map((n) => n.id));
    for (const n of p.taggedNodes) edges.push({ from: id, to: n.id });
    for (const n of p.authoredNodes) {
      if (!taggedIds.has(n.id)) edges.push({ from: id, to: n.id, soft: true });
    }
  }

  // Relax: springs to anchors and along edges, pairwise separation.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (let t = 0; t < 260; t++) {
    for (const e of edges) {
      if (e.soft) continue;
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const target = a.r + b.r + 34;
      const f = ((dist - target) / dist) * 0.06;
      b.x -= dx * f;
      b.y -= dy * f;
      a.x += dx * f * 0.3;
      a.y += dy * f * 0.3;
    }
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 0.01);
        const minDist = a.r + b.r + (a.kind === "milestone" && b.kind === "milestone" ? 70 : 24);
        if (dist < minDist) {
          const f = ((minDist - dist) / dist) * 0.28;
          const wa = b.kind === "milestone" ? 0.3 : 1;
          const wb = a.kind === "milestone" ? 0.3 : 1;
          a.x -= dx * f * wa;
          a.y -= dy * f * wa;
          b.x += dx * f * wb;
          b.y += dy * f * wb;
        }
      }
      const pullX =
        a.kind === "milestone" ? 0.045 : a.kind === "person" ? 0.015 : a.floating ? 0.03 : 0.008;
      const pullY = a.kind === "person" ? 0.015 : a.floating ? 0.08 : 0.02;
      a.x += (a.ax - a.x) * pullX;
      a.y += (a.ay - a.y) * pullY;
      a.x = Math.min(Math.max(a.x, a.r + 12), W - a.r - 12);
      a.y = Math.min(Math.max(a.y, a.r + 40), H - a.r - 16);
    }
  }

  return { nodes, edges };
}

// Everything one hop out from a node, plus the people around a
// subcategory's moments, so a hover pulls the whole story forward.
function clusterOf(id: string, byId: Map<string, Node>, edges: Edge[]): Set<string> {
  const out = new Set<string>([id]);
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const first = adj.get(id) ?? [];
  for (const n of first) out.add(n);
  const me = byId.get(id);
  if (me?.kind === "milestone") {
    for (const n of first) for (const p of adj.get(n) ?? []) {
      if (byId.get(p)?.kind === "person") out.add(p);
    }
  }
  if (me?.kind === "moment") {
    for (const n of first) {
      const nn = byId.get(n);
      if (nn?.kind === "milestone") for (const p of adj.get(n) ?? []) out.add(p);
    }
  }
  return out;
}

const INTRO_KEY = "lore-sky-intro";

export default function ConstellationView({
  data,
  forceIntro = false,
}: {
  data: TimelineData;
  forceIntro?: boolean;
}) {
  const { nodes, edges } = useMemo(() => buildSky(data), [data]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [scrubYear, setScrubYear] = useState<string | null>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Entrance: nodes start on their time anchors, invisible, and settle
  // into place in waves — subcategories, then moments, then people — with
  // the edges drawing themselves in behind. Once per visit.
  // "pending" paints nothing (first frame), "playing" snaps everything to
  // its anchor with transitions off, "done" lets the transitions carry
  // nodes and edges into place.
  const [intro, setIntro] = useState<"pending" | "playing" | "done">("pending");
  useEffect(() => {
    let seen = false;
    try {
      seen = !forceIntro && window.sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (seen || reduce) {
        setIntro("done");
        return;
      }
      setIntro("playing");
      raf2 = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setIntro("done");
          try {
            window.sessionStorage.setItem(INTRO_KEY, "1");
          } catch {}
        })
      );
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [forceIntro]);
  const settled = intro !== "playing";

  const years = useMemo(() => {
    const seen = new Map<string, number>();
    for (const n of nodes) {
      if (n.kind !== "milestone" || !n.milestone?.date_start) continue;
      const y = n.milestone.date_start.slice(0, 4);
      seen.set(y, Math.min(seen.get(y) ?? Infinity, n.ax));
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [nodes]);

  // Focus: a hovered or selected node's cluster comes forward; a scrubbed
  // year keeps only its own nodes lit.
  const focusId = hovered ?? selected?.id ?? null;
  const cluster = useMemo(
    () => (focusId ? clusterOf(focusId, byId, edges) : null),
    [focusId, byId, edges]
  );
  const dimmed = (n: Node): boolean => {
    if (cluster && !cluster.has(n.id)) return true;
    if (scrubYear && n.year !== scrubYear && n.kind !== "person") return true;
    if (scrubYear && n.kind === "person") return !cluster;
    return false;
  };
  const lit = (n: Node): boolean => !!cluster && cluster.has(n.id);

  // Stagger for the entrance, by kind then by position in time.
  const delayFor = (n: Node): number => {
    const t = (n.ax - PAD) / (W - PAD * 2);
    if (n.kind === "milestone") return t * 500;
    if (n.kind === "moment") return 450 + t * 500;
    return 900 + t * 400;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    setTf((prev) => {
      const k = Math.min(Math.max(prev.k * (e.deltaY < 0 ? 1.12 : 0.9), 0.6), 4);
      const wx = (px - prev.x) / prev.k;
      const wy = (py - prev.y) / prev.k;
      return { k, x: px - wx * k, y: py - wy * k };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * W;
    const dy = ((e.clientY - drag.current.y) / rect.height) * H;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
    setTf((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  // The rail: drag across it to scrub through the years.
  const railYearAt = (clientX: number): string | null => {
    const rail = railRef.current;
    if (!rail || years.length === 0) return null;
    const rect = rail.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = years[0][0];
    let bestD = Infinity;
    for (const [y, ax] of years) {
      const d = Math.abs(ax - x);
      if (d < bestD) {
        bestD = d;
        best = y;
      }
    }
    return best;
  };
  const railDrag = useRef(false);
  const onRailDown = (e: React.PointerEvent) => {
    railDrag.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setScrubYear(railYearAt(e.clientX));
  };
  const onRailMove = (e: React.PointerEvent) => {
    if (!railDrag.current) return;
    setScrubYear(railYearAt(e.clientX));
  };
  const onRailUp = () => {
    railDrag.current = false;
  };

  // The svg letterboxes to keep circles round; the rail spans just the
  // drawn area so its ticks sit under the year rules.
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const cw = svg.clientWidth;
      const ch = svg.clientHeight;
      const contentW = Math.min(cw, (ch * W) / H);
      setInset(Math.max(0, (cw - contentW) / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);
  // On a phone the whole sky is a few hundred pixels wide, so start
  // zoomed in on where the nodes actually are; a drag still reaches the rest.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || svg.clientWidth >= 600 || nodes.length === 0) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const k = 1.9;
    setTf({ k, x: W / 2 - cx * k, y: H / 2 - cy * k });
  }, [nodes]);
  const railPct = (ax: number) => `${(ax / W) * 100}%`;
  const scrubX = scrubYear ? years.find(([y]) => y === scrubYear)?.[1] : undefined;

  return (
    <div className={s.skyWrap} data-intro={intro}>
      <div className={s.skyLegend}>
        <span>
          <span className={s.skyDotMilestone} /> Subcategories
        </span>
        <span>
          <span className={s.skyDotMoment} /> Moments
        </span>
        <span>
          <span className={s.skyDotPerson} /> People
        </span>
        <span className={s.skyHint}>
          Hover to focus · click to open · drag to pan · scroll to zoom
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={s.sky}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Connected graph of subcategories and moments"
      >
        <defs>
          {nodes
            .filter((n) => n.img)
            .map((n) => (
              <clipPath key={n.id} id={`clip-${n.id}`}>
                <circle cx={0} cy={0} r={n.r} />
              </clipPath>
            ))}
        </defs>
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          {/* years as hairline rules with big numerals: the graph is plotted on time */}
          {years.map(([year, x], i) => (
            <g
              key={year}
              className={`${s.skyYear} ${scrubYear === year ? s.skyYearActive : ""}`}
              style={{ transitionDelay: `${i * 60}ms` }}
              onClick={() => setScrubYear(scrubYear === year ? null : year)}
            >
              <line x1={x} y1={0} x2={x} y2={H} className={s.skyYearLine} />
              <text x={x + 12} y={92} className={`${s.skyYearText} num`}>
                {year}
              </text>
            </g>
          ))}
          {edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const active =
              cluster && cluster.has(a.id) && cluster.has(b.id) && !e.soft;
            const faded =
              (cluster && !(cluster.has(a.id) && cluster.has(b.id))) ||
              (scrubYear && (dimmed(a) || dimmed(b)));
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                pathLength={1}
                style={{ transitionDelay: `${Math.max(delayFor(a), delayFor(b))}ms` }}
                className={`${
                  active
                    ? s.skyEdgeActive
                    : e.soft
                      ? s.skyEdgeAuthor
                      : a.kind === "person" || b.kind === "person"
                        ? s.skyEdgePerson
                        : s.skyEdge
                } ${s.skyEdgeDraw} ${faded ? s.skyFaded : ""}`}
              />
            );
          })}
          {nodes.map((n, i) => {
            const x = settled ? n.x : n.ax;
            const y = settled ? n.y : n.ay;
            return (
              <g
                key={n.id}
                data-kind={n.kind}
                data-hovered={hovered === n.id ? "" : undefined}
                className={`${s.skyNode} ${dimmed(n) ? s.skyFaded : ""} ${lit(n) ? s.skyLit : ""}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transitionDelay: `${delayFor(n)}ms`,
                }}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => {
                  if (drag.current?.moved) return;
                  setSelected(selected?.id === n.id ? null : n);
                }}
              >
                <g
                  className={s.nodeLive}
                  style={{ animationDelay: `${-((i % 9) * 0.9)}s` }}
                >
                  <g className={s.nodeScale}>
                    {n.kind === "milestone" ? (
                      <>
                        {n.upcoming && <circle r={n.r + 8} className={s.skyPulse} />}
                        <circle
                          r={n.r}
                          className={
                            n.upcoming ? s.skyMilestoneUpcoming : s.skyMilestone
                          }
                        />
                      </>
                    ) : n.kind === "person" ? (
                      <>
                        <circle r={n.r} className={s.skyPerson} />
                        <text y={4.5} className={s.skyPersonInitial}>
                          {n.label.slice(0, 1)}
                        </text>
                      </>
                    ) : n.img ? (
                      <>
                        <circle r={n.r + 1.5} className={s.skyMomentRing} />
                        <image
                          href={n.img}
                          x={-n.r}
                          y={-n.r}
                          width={n.r * 2}
                          height={n.r * 2}
                          clipPath={`url(#clip-${n.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <circle r={5} className={s.skyMomentDot} />
                    )}
                  </g>
                </g>
                {n.kind === "moment" && (
                  <text y={n.r * 2.2 + 14} className={s.skyMomentLabel}>
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
          {nodes
            .filter((n) => n.kind === "milestone")
            .map((n) => (
              <text
                key={`label-${n.id}`}
                x={settled ? n.x : n.ax}
                y={(settled ? n.y : n.ay) + n.r + 20}
                style={{ transitionDelay: `${delayFor(n) + 200}ms` }}
                className={`${s.skyLabel} ${dimmed(n) ? s.skyFaded : ""} ${settled ? "" : s.skyHidden}`}
              >
                {n.label}
              </text>
            ))}
          {nodes
            .filter((n) => n.kind === "person")
            .map((n) => (
              <text
                key={`label-${n.id}`}
                x={settled ? n.x : n.ax}
                y={(settled ? n.y : n.ay) + n.r + 16}
                style={{ transitionDelay: `${delayFor(n) + 200}ms` }}
                className={`${s.skyLabel} ${s.skyPersonLabel} ${dimmed(n) ? s.skyFaded : ""} ${settled ? "" : s.skyHidden}`}
              >
                {n.label}
              </text>
            ))}
        </g>
      </svg>

      {/* the rail: one year at a time */}
      <div className={s.skyRail}>
        <div
          ref={railRef}
          className={s.skyRailTrack}
          style={{ marginLeft: inset, marginRight: inset }}
          onPointerDown={onRailDown}
          onPointerMove={onRailMove}
          onPointerUp={onRailUp}
          onPointerCancel={onRailUp}
          role="slider"
          aria-label="Scrub through the years"
          aria-valuetext={scrubYear ?? "All years"}
        >
          <div className={s.skyRailLine} />
          {years.map(([year, ax]) => (
            <button
              key={year}
              type="button"
              className={`${s.skyRailTick} num ${scrubYear === year ? s.skyRailTickActive : ""}`}
              style={{ left: railPct(ax) }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setScrubYear(scrubYear === year ? null : year)}
            >
              {year}
            </button>
          ))}
          {scrubX !== undefined && (
            <div className={s.skyRailHandle} style={{ left: railPct(scrubX) }} />
          )}
        </div>
        <button
          type="button"
          className={`${s.skyRailAll} ${scrubYear ? "" : s.skyRailAllActive}`}
          onClick={() => setScrubYear(null)}
        >
          All years
        </button>
      </div>

      {selected && (
        <div className={s.skyCard}>
          <button className={s.skyCardClose} onClick={() => setSelected(null)}>
            ×
          </button>
          {selected.kind === "milestone" && selected.milestone ? (
            <>
              <div className={s.skyCardKicker}>
                {fmtDate(selected.milestone)}
                {selected.milestone.location
                  ? ` · ${selected.milestone.location}`
                  : ""}{" "}
                <CategoryChip label={selected.milestone.category} />
              </div>
              <div className={s.skyCardTitle}>{selected.milestone.title}</div>
              {selected.milestone.blurb && (
                <p className={s.skyCardBody}>{selected.milestone.blurb}</p>
              )}
              <div className={s.skyCardKicker}>
                {selected.milestone.moments.length} moment
                {selected.milestone.moments.length === 1 ? "" : "s"} attached
              </div>
              {selected.milestone.moments.slice(0, 5).map((m) => (
                <Link key={m.id} href={`/moment/${m.id}`} className={s.skyCardLink}>
                  {m.title} →
                </Link>
              ))}
              {selected.milestone.moments.length > 5 && (
                <div className={s.skyCardKicker}>
                  and {selected.milestone.moments.length - 5} more
                </div>
              )}
              <Link
                href={`/event/${selected.milestone.id}`}
                className={s.skyCardLink}
              >
                Open this event →
              </Link>
            </>
          ) : selected.kind === "person" ? (
            (() => {
              const tagged = selected.personMoments ?? [];
              const authored = selected.personAuthored ?? [];
              const seen = new Set<string>();
              const all = [...authored, ...tagged].filter((m) =>
                seen.has(m.id) ? false : (seen.add(m.id), true)
              );
              return (
                <>
                  <div className={s.skyCardTitle}>{selected.label}</div>
                  <div className={s.skyCardKicker}>
                    {[
                      authored.length > 0
                        ? `Posted ${authored.length} moment${authored.length === 1 ? "" : "s"}`
                        : null,
                      tagged.length > 0 ? `tagged in ${tagged.length}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {all.slice(0, 5).map((m) => (
                    <Link
                      key={m.id}
                      href={`/moment/${m.id}`}
                      className={s.skyCardLink}
                    >
                      {m.title} →
                    </Link>
                  ))}
                  {all.length > 5 && (
                    <div className={s.skyCardKicker}>
                      and {all.length - 5} more
                    </div>
                  )}
                </>
              );
            })()
          ) : selected.moment ? (
            <>
              <Link
                href={`/moment/${selected.moment.id}`}
                className={s.momentTitleLink}
              >
                <div className={s.skyCardTitle}>{selected.moment.title}</div>
              </Link>
              <div className={s.skyCardKicker}>
                {byline(selected.moment)}{" "}
                <CategoryChip label={selected.moment.category} />
              </div>
              <Link href={`/moment/${selected.moment.id}`} className={s.skyCardLink}>
                Open this moment →
              </Link>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
