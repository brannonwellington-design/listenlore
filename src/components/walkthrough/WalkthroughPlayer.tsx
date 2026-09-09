"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MediaItem, Milestone, Moment } from "@/lib/types";
import type { Walkthrough as Script } from "@/lib/walkthrough";
import {
  buildSchedule,
  fmtClock,
  segmentAt,
  type ScriptView,
  type Segment,
} from "@/lib/walkthrough-script";
import { MediaEl } from "../timeline/shared";
import s from "./walkthrough.module.css";

export type TourView = "album" | "grid" | "constellation";

interface StopDetail {
  id: string;
  title: string;
  when: string;
  media: MediaItem | null;
}

// Stops can target an event or a single moment; a moment's photo becomes
// the frame, and its scroll target falls back to its parent event when it
// has no element of its own on the page.
function describe(id: string, milestones: Milestone[], moments: Moment[]): StopDetail | null {
  const ms = milestones.find((m) => m.id === id);
  if (ms) {
    return {
      id,
      title: ms.title,
      when: ms.date_start ?? "",
      media: ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0] ?? null,
    };
  }
  const mo = moments.find((m) => m.id === id);
  if (!mo) return null;
  return { id, title: mo.title, when: mo.event_date ?? "", media: mo.media[0] ?? null };
}

function targetEl(id: string, moments: Moment[]): HTMLElement | null {
  const own =
    document.querySelector<HTMLElement>(`[data-event-id="${id}"]`) ??
    document.querySelector<HTMLElement>(`[data-moment-id="${id}"]`);
  if (own) return own;
  const parent = moments.find((m) => m.id === id)?.milestone_id;
  return parent ? document.querySelector<HTMLElement>(`[data-event-id="${parent}"]`) : null;
}
function heroEl(id: string): HTMLElement | null {
  return (
    document
      .querySelector<HTMLElement>(`[data-event-id="${id}"]`)
      ?.querySelector<HTMLElement>("[data-event-hero]") ?? null
  );
}
// Where the page should be scrolled so a stop sits mid-screen.
function targetY(id: string, moments: Moment[]): number {
  const el = targetEl(id, moments);
  if (!el) return window.scrollY;
  const r = el.getBoundingClientRect();
  const h = Math.min(r.height, window.innerHeight * 0.8);
  return Math.max(0, window.scrollY + r.top - (window.innerHeight - h) / 2);
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function viewFor(seg: Segment | null): TourView {
  if (seg?.kind === "view") return seg.view === "grid" ? "grid" : "constellation";
  return "album";
}
const VIEW_TITLES: Record<ScriptView, string> = {
  grid: "Wandering the Grid",
  nodes: "The Nodes settle in",
};

// The tour itself. Lives above the view switch so it survives the trips
// through the Grid and the Nodes: it owns the clock (the narration's time
// when there is a track, else elapsed time), tells the shell which view
// to show, scrolls the Timeline in step, and at each stop grows the
// stop's photo out of its frame with the words for that stop.
export default function WalkthroughPlayer({
  script,
  milestones,
  moments,
  running,
  view,
  onView,
  onEnd,
}: {
  script: Script;
  milestones: Milestone[];
  moments: Moment[];
  running: boolean;
  view: TourView;
  onView: (v: TourView) => void;
  onEnd: () => void;
}) {
  const known = useCallback(
    (id: string) => milestones.some((m) => m.id === id) || moments.some((m) => m.id === id),
    [milestones, moments]
  );
  const schedule = useMemo(() => buildSchedule(script.items, known), [script.items, known]);
  const details = useMemo(
    () => schedule.stops.map((st) => describe(st.id, milestones, moments)),
    [schedule, milestones, moments]
  );

  const [paused, setPaused] = useState(false);
  const [t, setT] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clock = useRef<{ base: number; started: number }>({ base: 0, started: 0 });
  const raf = useRef(0);
  const hasAudio = !!script.audioUrl;

  const seg = segmentAt(schedule, t);
  const stopIndex =
    seg?.kind === "focus" || (seg?.kind === "rest" && seg.stop !== null)
      ? (seg.stop as number)
      : seg?.kind === "travel"
        ? seg.from
        : null;
  const current = stopIndex !== null && stopIndex >= 0 ? schedule.stops[stopIndex] : null;
  const currentDetail = stopIndex !== null && stopIndex >= 0 ? details[stopIndex] : null;
  const holding = seg?.kind === "focus";

  const seekTo = useCallback(
    (seconds: number) => {
      if (audioRef.current && hasAudio) audioRef.current.currentTime = seconds;
      clock.current = { base: seconds, started: performance.now() };
      setT(seconds);
    },
    [hasAudio]
  );

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      if (next) audioRef.current?.pause();
      else {
        clock.current = { base: clock.current.base, started: performance.now() };
        if (audioRef.current && hasAudio) audioRef.current.play().catch(() => {});
      }
      return next;
    });
  }, [hasAudio]);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    audioRef.current?.pause();
    setPaused(false);
    setT(0);
    clock.current = { base: 0, started: 0 };
    onEnd();
  }, [onEnd]);

  // Starting: rewind and go.
  const startedRef = useRef(false);
  useEffect(() => {
    if (running && !startedRef.current) {
      startedRef.current = true;
      const id = requestAnimationFrame(() => {
        seekTo(0);
        setPaused(false);
        if (audioRef.current && hasAudio) audioRef.current.play().catch(() => {});
      });
      return () => cancelAnimationFrame(id);
    }
    if (!running) startedRef.current = false;
  }, [running, seekTo, hasAudio]);

  // The shell shows whichever view the current segment wants.
  const wantView = viewFor(seg);
  useEffect(() => {
    if (!running) return;
    if (wantView !== view) onView(wantView);
  }, [running, wantView, view, onView]);

  // Drive the clock, then place the page for that moment.
  useEffect(() => {
    if (!running || paused) return;
    let last = -1;
    const tick = () => {
      const a = audioRef.current;
      const now =
        a && hasAudio
          ? a.currentTime
          : clock.current.base + (performance.now() - clock.current.started) / 1000;
      if (!(a && hasAudio)) clock.current = { base: now, started: performance.now() };
      if (now >= schedule.total) {
        stop();
        return;
      }
      if (now !== last) {
        last = now;
        setT(now);
        const sg = segmentAt(schedule, now);
        if (sg && sg.kind !== "view" && view === "album") {
          let y: number | null = null;
          if (sg.kind === "travel") {
            const p = ease(Math.min(1, (now - sg.start) / Math.max(sg.end - sg.start, 0.001)));
            const from = sg.from === null ? 0 : targetY(schedule.stops[sg.from].id, moments);
            const to = targetY(schedule.stops[sg.to].id, moments);
            y = from + p * (to - from);
          } else if (sg.kind === "focus") {
            y = targetY(schedule.stops[sg.stop].id, moments);
          } else if (sg.kind === "rest") {
            y = sg.stop === null ? 0 : targetY(schedule.stops[sg.stop].id, moments);
          }
          if (y !== null) window.scrollTo(0, y);
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, paused, schedule, hasAudio, stop, view, moments]);

  // A hand on the wheel pauses the tour; Escape ends it; space toggles.
  useEffect(() => {
    if (!running) return;
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
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [running, stop, togglePause]);

  const jump = (dir: 1 | -1) => {
    const i = stopIndex ?? -1;
    const target = i + dir;
    if (target < 0) seekTo(0);
    else if (target < schedule.stops.length) seekTo(schedule.stops[target].at);
    if (paused) togglePause();
  };

  // The focused photo: measured from its frame on the page, then grown.
  const [frame, setFrame] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const focusId = running && holding && current ? current.id : null;
  const hasMedia = !!currentDetail?.media;
  const textRef = useRef<HTMLDivElement>(null);
  // The grown frame fills the room above the words: measure the text block
  // as rendered (a two-line title and a long caption need more than a
  // fixed reserve) and fit the photo into what is left.
  const grown = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const phone = vw < 760;
    const margin = phone ? 16 : 96;
    const top = phone ? 24 : 56;
    const gap = phone ? 16 : 32;
    const textBottom = phone ? 88 : 96;
    const textH = textRef.current?.offsetHeight ?? 200;
    const width = vw - margin * 2;
    const room = vh - top - gap - textH - textBottom;
    const height = Math.max(120, Math.min(room, width * (phone ? 1.1 : 0.62)));
    return { left: margin, top: top + Math.max(0, (room - height) / 2), width, height };
  }, []);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      const el = focusId ? heroEl(focusId) : null;
      if (!el) {
        // No frame on the page to grow from: cut straight to the frame if
        // the stop has a photo, else show the words alone.
        setFrame(focusId && hasMedia ? grown() : null);
        return;
      }
      const r = el.getBoundingClientRect();
      setFrame({ left: r.left, top: r.top, width: r.width, height: r.height });
      raf2 = requestAnimationFrame(() => requestAnimationFrame(() => setFrame(grown())));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [focusId, hasMedia, grown]);
  // Tell the page it is behind the overlay (see .shell in timeline.module.css).
  const focusOn = !!frame && holding;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-tour-focus", focusOn);
    return () => document.documentElement.removeAttribute("data-tour-focus");
  }, [focusOn]);
  // Keep the frame fitted if the window changes while a stop is held.
  useEffect(() => {
    if (!focusId || !hasMedia) return;
    const onResize = () => setFrame(grown());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [focusId, hasMedia, grown]);

  const doneCount = schedule.stops.filter((st) => t >= st.at).length;
  const total = schedule.total;

  const barTitle = (() => {
    if (!seg) return <span className={s.barKicker}>Starting the story…</span>;
    if (seg.kind === "view") return <span className={s.barKicker}>{VIEW_TITLES[seg.view]}</span>;
    if (seg.kind === "travel") {
      const to = details[seg.to];
      return (
        <>
          <span className={s.barKicker}>On the way to · </span>
          {to?.title}
        </>
      );
    }
    if (seg.kind === "rest" && seg.stop === null)
      return <span className={s.barKicker}>A moment before we begin</span>;
    return (
      <>
        <span className={s.barKicker}>
          {(stopIndex ?? 0) + 1}/{schedule.stops.length} ·{" "}
        </span>
        {currentDetail?.title}
      </>
    );
  })();

  return (
    <>
      {script.audioUrl && <audio ref={audioRef} src={script.audioUrl} preload="auto" />}
      {running &&
        createPortal(
          <>
            <div className={`${s.focus} ${frame && holding ? s.focusOn : ""}`} aria-hidden="true">
              <div className={s.focusScrim} />
              {frame && currentDetail && (
                <div className={s.focusFrame} style={frame}>
                  {currentDetail.media && (
                    <MediaEl media={currentDetail.media} className={s.focusMedia} alt={currentDetail.title} />
                  )}
                </div>
              )}
              {holding && current && currentDetail && (
                <div className={s.focusText} ref={textRef}>
                  <div className={s.focusBody}>
                    <div className={`${s.focusKicker} num`}>
                      {currentDetail.when.slice(0, 4)} · Stop {(stopIndex ?? 0) + 1} of{" "}
                      {schedule.stops.length}
                    </div>
                    <div className={s.focusTitle}>{currentDetail.title}</div>
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
                <div className={s.barTitle}>{barTitle}</div>
                <div className={s.barTrack}>
                  <div className={s.barFill} style={{ width: `${(t / Math.max(total, 1)) * 100}%` }} />
                  {schedule.stops.map((st, i) => (
                    <span
                      key={`${st.id}-${i}`}
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
