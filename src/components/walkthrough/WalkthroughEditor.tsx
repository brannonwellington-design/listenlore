"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import f from "../form.module.css";
import s from "./walkthrough.module.css";
import { uploadToStorage } from "@/lib/upload-client";
import type { Walkthrough, WalkthroughStop } from "@/lib/walkthrough";
import {
  requestAudioUploadTicket,
  saveWalkthroughScript,
} from "@/app/walkthrough/actions";

interface EventRow {
  id: string;
  title: string;
  when: string;
  thumb: string | null;
  moments: number;
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function parseClock(v: string): number {
  const parts = v.trim().split(":").map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return 0;
  if (parts.length === 1) return Math.max(0, parts[0]);
  return Math.max(0, parts[0] * 60 + parts[1]);
}

export default function WalkthroughEditor({
  events,
  script,
}: {
  events: EventRow[];
  script: Walkthrough;
}) {
  const [stops, setStops] = useState<Map<string, WalkthroughStop>>(
    () => new Map(script.stops.map((st) => [st.id, st]))
  );
  const [audioPath, setAudioPath] = useState<string | null>(script.audioPath);
  const [audioUrl, setAudioUrl] = useState<string | null>(script.audioUrl);
  const [upload, setUpload] = useState<{ progress: number; error?: string } | null>(null);
  const [state, formAction, pending] = useActionState(saveWalkthroughScript, null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = (ev: EventRow, on: boolean) => {
    setStops((prev) => {
      const next = new Map(prev);
      if (on) next.set(ev.id, prev.get(ev.id) ?? { id: ev.id, at: 0, text: "" });
      else next.delete(ev.id);
      return next;
    });
  };
  const patch = (id: string, part: Partial<WalkthroughStop>) => {
    setStops((prev) => {
      const cur = prev.get(id);
      if (!cur) return prev;
      const next = new Map(prev);
      next.set(id, { ...cur, ...part });
      return next;
    });
  };

  const onAudioFile = async (file: File | undefined) => {
    if (!file) return;
    setUpload({ progress: 0 });
    const res = await requestAudioUploadTicket({ type: file.type, size: file.size });
    if ("error" in res) {
      setUpload({ progress: 0, error: res.error });
      return;
    }
    try {
      await uploadToStorage(res.ticket, file, (p) => setUpload({ progress: p }));
      setAudioPath(res.ticket.path);
      setAudioUrl(URL.createObjectURL(file));
      setUpload(null);
    } catch (e) {
      setUpload({ progress: 0, error: (e as Error).message });
    }
  };

  // The saved order is the timeline's; timestamps decide when each plays.
  const payload = useMemo(
    () =>
      JSON.stringify({
        version: 1,
        audioPath,
        stops: events.filter((e) => stops.has(e.id)).map((e) => stops.get(e.id)!),
      }),
    [events, stops, audioPath]
  );
  const count = stops.size;

  return (
    <form action={formAction} className={s.editor}>
      <input type="hidden" name="payload" value={payload} />

      <section className={s.audioBox}>
        <div className={f.label}>Narration track</div>
        {audioUrl ? (
          <audio ref={audioRef} src={audioUrl} controls className={s.audio} />
        ) : (
          <p className={s.audioNote}>
            No recording yet. Without one, the tour plays on a silent clock
            using the timestamps below, so you can still test the flow.
          </p>
        )}
        <label className={s.audioPick}>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              onAudioFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {audioUrl ? "Replace the track" : "Upload a track"}
        </label>
        {upload && !upload.error && (
          <span className={s.audioNote}>Uploading… {Math.round(upload.progress * 100)}%</span>
        )}
        {upload?.error && <span className={f.error}>{upload.error}</span>}
        {audioUrl && (
          <span className={s.audioNote}>
            Play the track and press “now” on a row to stamp the moment it
            reaches that event.
          </span>
        )}
      </section>

      <div className={s.rows}>
        {events.map((ev) => {
          const st = stops.get(ev.id);
          return (
            <div key={ev.id} className={`${s.row} ${st ? s.rowOn : ""}`}>
              <label className={s.rowPick}>
                <input
                  type="checkbox"
                  checked={!!st}
                  onChange={(e) => toggle(ev, e.target.checked)}
                />
                {ev.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.thumb} alt="" className={s.rowThumb} />
                ) : (
                  <span className={s.rowThumbEmpty} />
                )}
                <span className={s.rowTitle}>
                  {ev.title}
                  <span className={s.rowMeta}>
                    {ev.when.slice(0, 4)} · {ev.moments} moment{ev.moments === 1 ? "" : "s"}
                  </span>
                </span>
              </label>
              {st && (
                <div className={s.rowFields}>
                  <label className={s.rowAt}>
                    <span className={f.label}>Begins at</span>
                    <span className={s.rowAtInput}>
                      <input
                        className={`${f.input} num`}
                        value={fmtClock(st.at)}
                        onChange={(e) => patch(ev.id, { at: parseClock(e.target.value) })}
                        onBlur={(e) => patch(ev.id, { at: parseClock(e.target.value) })}
                        inputMode="numeric"
                        aria-label={`When ${ev.title} begins, minutes and seconds`}
                      />
                      {audioUrl && (
                        <button
                          type="button"
                          className={s.nowBtn}
                          onClick={() =>
                            patch(ev.id, { at: audioRef.current?.currentTime ?? 0 })
                          }
                        >
                          now
                        </button>
                      )}
                    </span>
                  </label>
                  <label className={s.rowText}>
                    <span className={f.label}>What is said here</span>
                    <textarea
                      className={f.input}
                      rows={3}
                      maxLength={2000}
                      value={st.text}
                      onChange={(e) => patch(ev.id, { text: e.target.value })}
                      placeholder="The narration for this stop, shown as a caption while it plays…"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state && "error" in state && <p className={f.error}>{state.error}</p>}
      <div className={s.saveRow}>
        <button type="submit" className={f.submit} disabled={pending || !!upload}>
          {pending ? "Saving…" : `Save script · ${count} stop${count === 1 ? "" : "s"}`}
        </button>
        {state && "ok" in state && !pending && (
          <span className={s.audioNote}>Saved. The timeline has the new script.</span>
        )}
      </div>
    </form>
  );
}
