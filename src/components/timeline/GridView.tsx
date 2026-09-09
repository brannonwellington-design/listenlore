"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaItem, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import { MediaEl } from "./shared";

// Every photo and video in the archive, with where it leads.
interface Tile {
  media: MediaItem;
  href: string;
  title: string;
  feature: boolean; // an event's own photo: worth a bigger square
}

function collect(data: TimelineData): Tile[] {
  const out: Tile[] = [];
  for (const ms of data.milestones) {
    for (const media of ms.media) {
      out.push({ media, href: `/event/${ms.id}`, title: ms.title, feature: true });
    }
    for (const m of ms.moments) {
      for (const media of m.media) {
        out.push({ media, href: `/moment/${m.id}`, title: m.title, feature: false });
      }
    }
  }
  for (const m of data.floatingMoments) {
    for (const media of m.media) {
      out.push({ media, href: `/moment/${m.id}`, title: m.title, feature: false });
    }
  }
  return out;
}

// Deterministic pseudo-random per region, so the plane is stable across
// visits but never repeats from one neighbourhood to the next.
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(a: number, b: number, c: number): number {
  let h = 2166136261;
  for (const v of [a, b, c]) {
    h ^= v + 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const CHUNK = 12; // cells per side of one region

// Regions are laid out once per set of tiles and kept outside React.
const regionCache = new WeakMap<Tile[], Map<string, Placed[]>>();
function regionsFor(tiles: Tile[]): Map<string, Placed[]> {
  let m = regionCache.get(tiles);
  if (!m) {
    m = new Map();
    regionCache.set(tiles, m);
  }
  return m;
}

interface Placed {
  cx: number;
  cy: number;
  span: 1 | 2;
  tile: Tile;
}

// One region of the plane: a shuffled pass over every tile, with a few
// 2×2 features where an event photo lands and there is room.
function layoutChunk(chunkX: number, chunkY: number, tiles: Tile[]): Placed[] {
  const n = tiles.length;
  if (n === 0) return [];
  const rand = mulberry(hash(chunkX, chunkY, n));
  const order = tiles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const taken = new Set<string>();
  const out: Placed[] = [];
  let k = 0;
  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      if (taken.has(`${lx},${ly}`)) continue;
      const tile = tiles[order[k % n]];
      k++;
      const canFeature =
        lx < CHUNK - 1 &&
        ly < CHUNK - 1 &&
        !taken.has(`${lx + 1},${ly}`) &&
        !taken.has(`${lx},${ly + 1}`) &&
        !taken.has(`${lx + 1},${ly + 1}`);
      const feature = canFeature && (tile.feature ? rand() < 0.5 : rand() < 0.07);
      const cx = chunkX * CHUNK + lx;
      const cy = chunkY * CHUNK + ly;
      if (feature) {
        taken.add(`${lx + 1},${ly}`);
        taken.add(`${lx},${ly + 1}`);
        taken.add(`${lx + 1},${ly + 1}`);
        out.push({ cx, cy, span: 2, tile });
      } else {
        out.push({ cx, cy, span: 1, tile });
      }
      taken.add(`${lx},${ly}`);
    }
  }
  return out;
}

export default function GridView({
  data,
  drift = false,
}: {
  data: TimelineData;
  drift?: boolean;
}) {
  const tiles = useMemo(() => collect(data), [data]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    t: number;
    moved: boolean;
  } | null>(null);
  const inertia = useRef(0);
  const lastMoved = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Base tile = two grid columns (one on phones); features are twice that.
  const gutter = 24;
  const cols = size.w < 760 ? 3 : 12;
  const span = size.w < 760 ? 1 : 2;
  const colW = (size.w - (cols - 1) * gutter) / cols;
  const unit = span * colW + (span - 1) * gutter;
  const pitch = unit + gutter;

  const placed = useMemo(() => {
    if (!size.w || !pitch) return [];
    const x0 = Math.floor(-offset.x / pitch) - 2;
    const x1 = Math.ceil((size.w - offset.x) / pitch) + 1;
    const y0 = Math.floor(-offset.y / pitch) - 2;
    const y1 = Math.ceil((size.h - offset.y) / pitch) + 1;
    const out: Placed[] = [];
    for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) {
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
        const key = `${cx},${cy}`;
        const chunks = regionsFor(tiles);
        let list = chunks.get(key);
        if (!list) {
          list = layoutChunk(cx, cy, tiles);
          chunks.set(key, list);
        }
        for (const p of list) {
          if (p.cx + p.span - 1 < x0 || p.cx > x1 || p.cy + p.span - 1 < y0 || p.cy > y1)
            continue;
          out.push(p);
        }
      }
    }
    return out;
  }, [offset, size, pitch, tiles]);

  const stopInertia = () => cancelAnimationFrame(inertia.current);

  const onPointerDown = (e: React.PointerEvent) => {
    stopInertia();
    drag.current = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const now = performance.now();
    const dt = Math.max(now - d.t, 1);
    d.vx = dx / dt;
    d.vy = dy / dt;
    d.t = now;
    d.x = e.clientX;
    d.y = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    lastMoved.current = d.moved;
    // a flick keeps going and eases out
    let vx = d.vx * 16;
    let vy = d.vy * 16;
    const step = () => {
      vx *= 0.94;
      vy *= 0.94;
      if (Math.abs(vx) + Math.abs(vy) < 0.3) return;
      setOffset((o) => ({ x: o.x + vx, y: o.y + vy }));
      inertia.current = requestAnimationFrame(step);
    };
    if (Math.abs(vx) + Math.abs(vy) > 2) inertia.current = requestAnimationFrame(step);
  };
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    stopInertia();
    setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = pitch || 200;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    setOffset((o) => ({ x: o.x + d[0], y: o.y + d[1] }));
  };

  // On the tour the plane wanders by itself, slowly, up and to the left.
  useEffect(() => {
    if (!drift) return;
    let id = 0;
    const step = () => {
      setOffset((o) => ({ x: o.x - 0.45, y: o.y - 0.3 }));
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [drift]);

  // Native wheel listener so preventDefault works (React's is passive).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  const count = tiles.length;

  return (
    <div className={s.gridView}>
      <div className={s.gridLegend}>
        <span>
          {count} photo{count === 1 ? "" : "s"} and video{count === 1 ? "" : "s"}, in
          every direction
        </span>
        <span className={s.gridHint}>Drag to wander · scroll to drift · click to open</span>
      </div>
      <div
        ref={wrapRef}
        className={s.gridPlane}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label="An endless grid of photos and videos. Drag to move around."
      >
        <div
          className={s.gridLayer}
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
        >
          {placed.map((p) => {
            const w = p.span === 2 ? unit * 2 + gutter : unit;
            return (
              <Link
                key={`${p.cx},${p.cy}`}
                href={p.tile.href}
                className={`${s.gridTile} ${p.span === 2 ? s.gridTileFeature : ""}`}
                style={{
                  left: p.cx * pitch,
                  top: p.cy * pitch,
                  width: w,
                  height: w,
                }}
                draggable={false}
                onClickCapture={(e) => {
                  if (lastMoved.current) e.preventDefault();
                }}
                title={p.tile.title}
              >
                <MediaEl media={p.tile.media} className={s.gridMedia} alt={p.tile.title} />
                <span className={s.gridCaption}>{p.tile.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
