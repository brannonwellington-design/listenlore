"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./tour.module.css";

export interface TourBeat {
  start: number;
  images: string[];
}

export interface TourData {
  audioUrl: string;
  duration: number;
  beats: TourBeat[];
}

// Which image should be on screen at t seconds in: find the active beat,
// then cycle its images evenly across the beat's window.
function frameAt(tour: TourData, t: number): string {
  let beatIdx = 0;
  for (let i = 0; i < tour.beats.length; i++) {
    if (t >= tour.beats[i].start) beatIdx = i;
  }
  const beat = tour.beats[beatIdx];
  const end = tour.beats[beatIdx + 1]?.start ?? tour.duration;
  const span = Math.max(end - beat.start, 0.001);
  const slice = Math.min(
    Math.floor(((t - beat.start) / span) * beat.images.length),
    beat.images.length - 1
  );
  return beat.images[Math.max(slice, 0)];
}

export default function LoreTour({ tour }: { tour: TourData }) {
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<string>(tour.beats[0]?.images[0] ?? "");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const close = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setOpen(false);
    setPaused(false);
    setProgress(0);
    setFrame(tour.beats[0]?.images[0] ?? "");
  }, [tour]);

  // Escape closes; arrow keys are left to the browser.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Preload every image once the tour opens so crossfades never flash.
  useEffect(() => {
    if (!open) return;
    for (const b of tour.beats) {
      for (const url of b.images) {
        const img = new Image();
        img.src = url;
      }
    }
  }, [open, tour]);

  const start = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => setPaused(true));
    });
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPaused(false);
    } else {
      a.pause();
      setPaused(true);
    }
  };

  const onTime = () => {
    const a = audioRef.current;
    if (!a) return;
    setFrame(frameAt(tour, a.currentTime));
    setProgress(a.currentTime / tour.duration);
  };

  return (
    <>
      <button type="button" className={s.playBtn} onClick={start}>
        ▶ Play the Lore
      </button>
      {open && (
        <div className={s.overlay} role="dialog" aria-label="Listen Lore tour">
          <audio
            ref={audioRef}
            src={tour.audioUrl}
            onTimeUpdate={onTime}
            onEnded={close}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={frame} src={frame} alt="" className={s.slide} />
          <div className={s.scrim} />
          <div className={s.controls}>
            <button type="button" className={s.controlBtn} onClick={toggle}>
              {paused ? "▶ Resume" : "❚❚ Pause"}
            </button>
            <div className={s.progressTrack}>
              <div
                className={s.progressFill}
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
            <button type="button" className={s.controlBtn} onClick={close}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
