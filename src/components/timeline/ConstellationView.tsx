"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import { byline, CategoryChip, fmtDate } from "./shared";

const W = 1280;
const H = 720;
const PAD = 96;

interface Node {
  id: string;
  kind: "milestone" | "moment";
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
}

interface Edge {
  from: string;
  to: string;
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
    });
  });

  // Relax: springs to anchors and along edges, pairwise separation.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (let t = 0; t < 260; t++) {
    for (const e of edges) {
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
      const pullX = a.kind === "milestone" ? 0.045 : a.floating ? 0.03 : 0.008;
      const pullY = a.floating ? 0.08 : 0.02;
      a.x += (a.ax - a.x) * pullX;
      a.y += (a.ay - a.y) * pullY;
      a.x = Math.min(Math.max(a.x, a.r + 12), W - a.r - 12);
      a.y = Math.min(Math.max(a.y, a.r + 40), H - a.r - 16);
    }
  }

  return { nodes, edges };
}

export default function ConstellationView({ data }: { data: TimelineData }) {
  const { nodes, edges } = useMemo(() => buildSky(data), [data]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const years = useMemo(() => {
    const seen = new Map<string, number>();
    for (const n of nodes) {
      if (n.kind !== "milestone" || !n.milestone?.date_start) continue;
      const y = n.milestone.date_start.slice(0, 4);
      seen.set(y, Math.min(seen.get(y) ?? Infinity, n.ax));
    }
    return [...seen.entries()];
  }, [nodes]);

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

  return (
    <div className={s.skyWrap}>
      <div className={s.skyLegend}>
        <span>
          <span className={s.skyDotMilestone} /> Milestones
        </span>
        <span>
          <span className={s.skyDotMoment} /> Moments
        </span>
        <span className={s.skyHint}>Drag to pan · scroll to zoom · click a node</span>
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
        aria-label="Connected graph of milestones and moments"
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
          {years.map(([year, x]) => (
            <g key={year}>
              <line x1={x} y1={28} x2={x} y2={H - 8} className={s.skyYearLine} />
              <text x={x + 10} y={44} className={s.skyYearText}>
                {year}
              </text>
            </g>
          ))}
          {edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            return (
              <line
                key={`${e.from}-${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={
                  selected && (selected.id === a.id || selected.id === b.id)
                    ? s.skyEdgeActive
                    : s.skyEdge
                }
              />
            );
          })}
          {nodes.map((n, i) => (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              className={s.skyNode}
              onClick={() => {
                if (drag.current?.moved) return;
                setSelected(selected?.id === n.id ? null : n);
              }}
            >
              <g
                className={s.nodeLive}
                style={{ animationDelay: `${-((i % 9) * 0.9)}s` }}
              >
              {n.kind === "milestone" ? (
                <>
                  {n.upcoming && <circle r={n.r + 8} className={s.skyPulse} />}
                  <circle
                    r={n.r}
                    className={n.upcoming ? s.skyMilestoneUpcoming : s.skyMilestone}
                  />
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
          ))}
          {nodes
            .filter((n) => n.kind === "milestone")
            .map((n) => (
              <text
                key={`label-${n.id}`}
                x={n.x}
                y={n.y + n.r + 20}
                className={s.skyLabel}
              >
                {n.label}
              </text>
            ))}
        </g>
      </svg>
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
            </>
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
