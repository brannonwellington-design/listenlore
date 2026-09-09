"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MediaItem, Milestone } from "@/lib/types";
import type { Walkthrough as Script } from "@/lib/walkthrough";
import { MediaEl } from "../timeline/shared";
import s from "./walkthrough.module.css";

// A stop resolved against the timeline: the event, its hero photo, and
// when in the narration it begins.
interface Stop {
  id: string;
  title: string;
  when: string;
  at: number;
  hold: number;
  text: string;
  media: MediaItem | null;
}

const DEFAULT_GAP = 14; // seconds per stop when there is no recording yet
const SCROLL_LEAD = 0.55; // share of the gap spent travelling to the next stop

type RawStop = Omit<Stop, "hold">;

function resolveStops(script: Script, milestones: Milestone[]): Stop[] {
  const byId = new Map(milestones.map((ms) => [ms.id, ms]));
  const raw: RawStop[] = [];
  for (const st of script.stops) {
    const ms = byId.get(st.id);
    if (!ms) continue;
    raw.push({
      id: ms.id,
      title: ms.title,
      when: ms.date_start ?? "",
      at: st.at,
      text: st.text,
      media: ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0] ?? null,
    });
  }
  // No timestamps yet: space the stops evenly on the silent clock.
  const timed: RawStop[] = raw.some((st) => st.at > 0)
    ? [...raw].sort((a, b) => a.at - b.at)
    : raw.map((st, i) => ({ ...st, at: i * DEFAULT_GAP + 4 }));
  return timed.map((st, i) => {
    const next = timed[i + 1];
    const gap = next ? next.at - st.at : DEFAULT_GAP;
    return { ...st, hold: Math.max(3, gap * (1 - SCROLL_LEAD)) };
  });
}

function fmtClock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function eventEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-event-id="${id}"]`);
}
function heroEl(id: string): HTMLElement | null {
  return eventEl(id)?.querySelector<HTMLElement>("[data-event-hero]") ?? null;
}
// Where the page should be scrolled so an event sits mid-screen.
function targetY(id: string): number {
  const el = eventEl(id);
  if (!el) return window.scrollY;
  const r = el.getBoundingClientRect();
  const h = Math.min(r.height, window.innerHeight * 0.8);
  return Math.max(0, window.scrollY + r.top - (window.innerHeight - h) / 2);
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// The play control in the Timeline's hero, and the tour itself once it
// runs: the page scrolls in step with the narration (or a silent clock),
// and at each stop the event's photo grows out of its frame to fill the
// screen while the words for that stop are shown.
export default function Walkthrough({
  script,
  milestones,
  canEdit,
}: {
  script: Script;
  milestones: Milestone[];
  canEdit: boolean;
}) {
  const stops = useMemo(() => resolveStops(script, milestones), [script, milestones]);
  const total = stops.length
    ? stops[stops.length - 1].at + stops[stops.length - 1].hold + 1
    : 0;

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [t, setT] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clock = useRef<{ base: number; started: number }>({ base: 0, started: 0 });
  const raf = useRef(0);
  const ignoreScroll = useRef(false);

  // Which stop is current, and whether we are holding on it.
  const idx = stops.findIndex((st, i) => t >= st.at && (i === stops.length - 1 || t < stops[i + 1].at));
  const current = idx >= 0 ? stops[idx] : null;
  const holding = !!current && t < current.at + current.hold;

  const seekTo = useCallback(
    (seconds: number) => {
      if (audioRef.current && script.audioUrl) audioRef.current.currentTime = seconds;
      clock.current = { base: seconds, started: performance.now() };
      setT(seconds);
    },
    [script.audioUrl]
  );

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) audioRef.current?.pause();
      else {
        clock.current = { base: clock.current.base, started: performance.now() };
        if (audioRef.current && script.audioUrl) audioRef.current.play().catch(() => {});
      }
      return next;
    });
  }, [script.audioUrl]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    audioRef.current?.pause();
    setRunning(false);
    setPaused(false);
    setT(0);
    clock.current = { base: 0, started: 0 };
  }, []);

  // Drive the clock: the audio's time when there is a track, else elapsed
  // time. Then place the page for that moment.
  useEffect(() => {
    if (!running || paused) return;
    let last = -1;
    const tick = () => {
      const a = audioRef.current;
      const now =
        a && script.audioUrl
          ? a.currentTime
          : clock.current.base + (performance.now() - clock.current.started) / 1000;
      if (!(a && script.audioUrl)) {
        clock.current = { base: now, started: performance.now() };
      }
      if (now >= total) {
        stop();
        return;
      }
      if (now !== last) {
        last = now;
        setT(now);
        // where should we be? between stops, ease from one to the next
        const i = stops.findIndex(
          (st, k) => now >= st.at && (k === stops.length - 1 || now < stops[k + 1].at)
        );
        let y: number;
        if (i < 0) {
          const first = stops[0];
          const p = first ? Math.min(1, now / Math.max(first.at, 0.001)) : 1;
          y = ease(p) * (first ? targetY(first.id) : 0);
        } else {
          const st = stops[i];
          const next = stops[i + 1];
          const from = targetY(st.id);
          if (!next || now < st.at + st.hold) y = from;
          else {
            const p = (now - st.at - st.hold) / Math.max(next.at - st.at - st.hold, 0.001);
            y = from + ease(Math.min(1, p)) * (targetY(next.id) - from);
          }
        }
        ignoreScroll.current = true;
        window.scrollTo(0, y);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, paused, stops, total, script.audioUrl, stop]);

  // A hand on the wheel pauses the tour; Escape ends it.
  useEffect(() => {
    if (!running) return;
    const onScroll = () => {
      if (ignoreScroll.current) {
        ignoreScroll.current = false;
        return;
      }
    };
    const onWheel = () => {
      setPaused((p) => {
        if (!p) {
          clock.current = {
            base: clock.current.base + (performance.now() - clock.current.started) / 1000,
            started: performance.now(),
          };
          audioRef.current?.pause();
        }
        return true;
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      if (e.key === " ") {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("scroll", onScroll);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [running, stop, togglePause]);

  const start = () => {
    if (stops.length === 0) return;
    setRunning(true);
    setPaused(false);
    seekTo(0);
    const a = audioRef.current;
    if (a && script.audioUrl) a.play().catch(() => {});
  };
  const jump = (dir: 1 | -1) => {
    const target = idx < 0 ? (dir > 0 ? 0 : -1) : idx + dir;
    if (target < 0) seekTo(0);
    else if (target < stops.length) seekTo(stops[target].at);
    if (paused) togglePause();
  };

  // The focused photo: measured from its frame on the page, then grown.
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const focusId = running && holding && current ? current.id : null;
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      const el = focusId ? heroEl(focusId) : null;
      if (!el) {
        setFrame(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setFrame({ left: r.left, top: r.top, width: r.width, height: r.height });
      raf2 = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const margin = vw < 760 ? 16 : 96;
          // leave the bottom quarter for the words and the bar
          const width = vw - margin * 2;
          const height = Math.max(240, Math.min(vh - 320, width * 0.62));
          setFrame({ left: margin, top: Math.max(56, (vh - 260 - height) / 2), width, height });
        })
      );
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [focusId]);

  const doneCount = stops.filter((st) => t >= st.at).length;

  return (
    <>
      <div className={s.playRow}>
        <button
          type="button"
          className={s.playBtn}
          onClick={start}
          disabled={stops.length === 0}
          aria-label="Play the walkthrough"
        >
          <span className={s.playGlyph} aria-hidden="true" />
          Play the walkthrough
        </button>
        {canEdit && (
          <Link href="/walkthrough/edit" className={s.editLink}>
            Edit script
          </Link>
        )}
        <span className={s.playNote}>
          {stops.length === 0
            ? canEdit
              ? "No stops yet. Add some in the script."
              : "No stops yet."
            : `${stops.length} stop${stops.length === 1 ? "" : "s"}${script.audioUrl ? " · narrated" : ""}`}
        </span>
      </div>

      {script.audioUrl && <audio ref={audioRef} src={script.audioUrl} preload="auto" />}

      {/* The overlay and the bar live on the body: the hero they are
          triggered from fades and lifts as you scroll, and a fixed layer
          inside it would inherit both. */}
      {running &&
        createPortal(
        <>
          <div className={`${s.focus} ${frame && holding ? s.focusOn : ""}`} aria-hidden="true">
            <div className={s.focusScrim} />
            {frame && current && (
              <div className={s.focusFrame} style={frame}>
                {current.media && (
                  <MediaEl media={current.media} className={s.focusMedia} alt={current.title} />
                )}
              </div>
            )}
            {current && (
              <div className={s.focusText}>
                <div className={s.focusBody}>
                  <div className={`${s.focusKicker} num`}>
                    {current.when.slice(0, 4)} · Stop {idx + 1} of {stops.length}
                  </div>
                  <div className={s.focusTitle}>{current.title}</div>
                  {current.text && <p className={s.focusCaption}>{current.text}</p>}
                </div>
              </div>
            )}
          </div>

          <div className={s.bar} role="region" aria-label="Walkthrough controls">
            <div className={s.barBtns}>
              <button type="button" className={s.barBtn} onClick={() => jump(-1)} aria-label="Previous stop">
                ‹
              </button>
              <button
                type="button"
                className={s.barBtn}
                onClick={togglePause}
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? "▶" : "❚❚"}
              </button>
              <button type="button" className={s.barBtn} onClick={() => jump(1)} aria-label="Next stop">
                ›
              </button>
            </div>
            <div className={s.barBody}>
              <div className={s.barTitle}>
                {current ? (
                  <>
                    <span className={s.barKicker}>{idx + 1}/{stops.length} · </span>
                    {current.title}
                  </>
                ) : (
                  <span className={s.barKicker}>Starting the story…</span>
                )}
              </div>
              <div className={s.barTrack}>
                <div className={s.barFill} style={{ width: `${(t / Math.max(total, 1)) * 100}%` }} />
                {stops.map((st, i) => (
                  <span
                    key={st.id}
                    className={`${s.barStop} ${i < doneCount ? s.barStopDone : ""}`}
                    style={{ left: `${(st.at / Math.max(total, 1)) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className={s.barBtns}>
              <span className={`${s.barTime} num`}>
                {fmtClock(t)} / {fmtClock(total)}
              </span>
              <button type="button" className={s.barBtn} onClick={stop} aria-label="End the walkthrough">
                ×
              </button>
            </div>
          </div>
        </>,
        document.body
        )}
    </>
  );
}
