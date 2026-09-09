"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import f from "../form.module.css";
import s from "./walkthrough.module.css";
import { uploadToStorage } from "@/lib/upload-client";
import type { Walkthrough } from "@/lib/walkthrough";
import {
  DEFAULT_OPENING,
  fmtClock,
  parseClock,
  type ScriptItem,
  type ScriptView,
} from "@/lib/walkthrough-script";
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
interface MomentRow {
  id: string;
  title: string;
  when: string;
  thumb: string | null;
  parent: string | null;
}

type Extra = Exclude<ScriptItem, { kind: "stop" }>;
type StopItem = Extract<ScriptItem, { kind: "stop" }>;

const EXTRA_LABELS: Record<Extra["kind"] | ScriptView, string> = {
  view: "Show a view",
  wait: "Wait",
  grid: "Show the Grid",
  nodes: "Show the Nodes",
};
function extraLabel(e: Extra): string {
  return e.kind === "wait" ? EXTRA_LABELS.wait : EXTRA_LABELS[e.view];
}

// The script is one ordered list: stops on events (or single moments),
// and between any two of them the extras — a wander through another view,
// or a plain wait. The editor shows events in timeline order and lets
// extras be slotted into the gap after each chosen stop (or before the
// first one).
export default function WalkthroughEditor({
  events,
  moments,
  script,
}: {
  events: EventRow[];
  moments: MomentRow[];
  script: Walkthrough;
}) {
  const [items, setItems] = useState<ScriptItem[]>(() =>
    script.items.length > 0 ? script.items : [...DEFAULT_OPENING]
  );
  const [audioPath, setAudioPath] = useState<string | null>(script.audioPath);
  const [audioUrl, setAudioUrl] = useState<string | null>(script.audioUrl);
  const [upload, setUpload] = useState<{ progress: number; error?: string } | null>(null);
  const [state, formAction, pending] = useActionState(saveWalkthroughScript, null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const stopOf = (id: string) =>
    items.find((it): it is StopItem => it.kind === "stop" && it.id === id);
  const orderIndex = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach((e, i) => m.set(e.id, i * 1000));
    moments.forEach((mo) => {
      const base = mo.parent ? (m.get(mo.parent) ?? 0) : events.length * 1000;
      m.set(mo.id, base + 1 + (m.size % 900));
    });
    return m;
  }, [events, moments]);

  // Insert a stop in timeline order: after the last stop that comes
  // before it (and that stop's extras), else after the opening extras.
  const addStop = (id: string) => {
    setItems((prev) => {
      const mine = orderIndex.get(id) ?? Infinity;
      let insertAt = 0;
      // skip the opening extras
      while (insertAt < prev.length && prev[insertAt].kind !== "stop") insertAt++;
      for (let i = 0; i < prev.length; i++) {
        const it = prev[i];
        if (it.kind === "stop" && (orderIndex.get(it.id) ?? Infinity) < mine) {
          insertAt = i + 1;
          while (insertAt < prev.length && prev[insertAt].kind !== "stop") insertAt++;
        }
      }
      const next = [...prev];
      next.splice(insertAt, 0, { kind: "stop", id, at: 0, text: "" });
      return next;
    });
  };
  const removeStop = (id: string) =>
    setItems((prev) => prev.filter((it) => !(it.kind === "stop" && it.id === id)));
  const patchStop = (id: string, part: Partial<StopItem>) =>
    setItems((prev) =>
      prev.map((it) => (it.kind === "stop" && it.id === id ? { ...it, ...part } : it))
    );

  // Extras live in the gap after a stop (or before the first stop when
  // `after` is null): appended to the end of that gap.
  const addExtra = (after: string | null, extra: Extra) => {
    setItems((prev) => {
      let i = 0;
      if (after !== null) {
        i = prev.findIndex((it) => it.kind === "stop" && it.id === after) + 1;
        if (i === 0) return prev;
      }
      while (i < prev.length && prev[i].kind !== "stop") i++;
      const next = [...prev];
      next.splice(i, 0, extra);
      return next;
    });
  };
  const patchExtra = (index: number, seconds: number) =>
    setItems((prev) =>
      prev.map((it, i) => (i === index && it.kind !== "stop" ? { ...it, seconds } : it))
    );
  const removeExtra = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

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

  const payload = useMemo(
    () => JSON.stringify({ version: 2, audioPath, items }),
    [items, audioPath]
  );
  const stopCount = items.filter((it) => it.kind === "stop").length;

  // The extras that follow a given stop (or open the script).
  const extrasAfter = (stopId: string | null): { index: number; extra: Extra }[] => {
    let i = 0;
    if (stopId !== null) {
      i = items.findIndex((it) => it.kind === "stop" && it.id === stopId) + 1;
      if (i === 0) return [];
    }
    const out: { index: number; extra: Extra }[] = [];
    while (i < items.length && items[i].kind !== "stop") {
      out.push({ index: i, extra: items[i] as Extra });
      i++;
    }
    return out;
  };

  const gap = (stopId: string | null) => (
    <div className={s.gap}>
      {extrasAfter(stopId).map(({ index, extra }) => (
        <div key={index} className={s.extra}>
          <span className={s.extraLabel}>{extraLabel(extra)}</span>
          <label className={s.extraSeconds}>
            <input
              className={`${f.input} num`}
              type="number"
              min={1}
              max={120}
              value={Math.round(extra.seconds)}
              onChange={(e) => patchExtra(index, Math.max(0, Number(e.target.value) || 0))}
              aria-label={`${extraLabel(extra)} for how many seconds`}
            />
            <span>s</span>
          </label>
          <button
            type="button"
            className={s.extraRemove}
            onClick={() => removeExtra(index)}
            aria-label={`Remove ${extraLabel(extra)}`}
          >
            Remove
          </button>
        </div>
      ))}
      <div className={s.gapAdd}>
        <span className={s.gapAddLabel}>
          {stopId === null ? "Before the first stop" : "Then"}
        </span>
        <button type="button" className={s.gapBtn} onClick={() => addExtra(stopId, { kind: "wait", seconds: 3 })}>
          + Wait
        </button>
        <button
          type="button"
          className={s.gapBtn}
          onClick={() => addExtra(stopId, { kind: "view", view: "grid", seconds: 6 })}
        >
          + Show the Grid
        </button>
        <button
          type="button"
          className={s.gapBtn}
          onClick={() => addExtra(stopId, { kind: "view", view: "nodes", seconds: 6 })}
        >
          + Show the Nodes
        </button>
      </div>
    </div>
  );

  const stopFields = (id: string, title: string, st: StopItem) => (
    <div className={s.rowFields}>
      <label className={s.rowAt}>
        <span className={f.label}>Begins at</span>
        <span className={s.rowAtInput}>
          <input
            className={`${f.input} num`}
            value={fmtClock(st.at)}
            onChange={(e) => patchStop(id, { at: parseClock(e.target.value) })}
            onBlur={(e) => patchStop(id, { at: parseClock(e.target.value) })}
            inputMode="numeric"
            aria-label={`When ${title} begins, minutes and seconds`}
          />
          {audioUrl && (
            <button
              type="button"
              className={s.nowBtn}
              onClick={() => patchStop(id, { at: audioRef.current?.currentTime ?? 0 })}
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
          onChange={(e) => patchStop(id, { text: e.target.value })}
          placeholder="The narration for this stop, shown as a caption while it plays…"
        />
      </label>
    </div>
  );

  // Moment stops already in the script show under their parent event.
  const momentStopsUnder = (eventId: string | null) =>
    moments.filter((mo) => mo.parent === eventId && !!stopOf(mo.id));

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
            using the timestamps and durations below, so you can still test
            the flow.
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
            reaches that event. Waits and view changes fit into the time
            between stops; the stop before them holds a little less.
          </span>
        )}
      </section>

      <div className={s.rows}>
        {gap(null)}
        {momentStopsUnder(null).map((mo) => {
          const st = stopOf(mo.id)!;
          return (
            <div key={mo.id} className={`${s.row} ${s.rowOn}`}>
              <label className={s.rowPick}>
                <input type="checkbox" checked onChange={() => removeStop(mo.id)} />
                {mo.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mo.thumb} alt="" className={s.rowThumb} />
                ) : (
                  <span className={s.rowThumbEmpty} />
                )}
                <span className={s.rowTitle}>
                  {mo.title}
                  <span className={s.rowMeta}>{mo.when.slice(0, 4)} · moment</span>
                </span>
              </label>
              {stopFields(mo.id, mo.title, st)}
              {gap(mo.id)}
            </div>
          );
        })}
        {events.map((ev) => {
          const st = stopOf(ev.id);
          return (
            <div key={ev.id} className={`${s.row} ${st ? s.rowOn : ""}`}>
              <label className={s.rowPick}>
                <input
                  type="checkbox"
                  checked={!!st}
                  onChange={(e) => (e.target.checked ? addStop(ev.id) : removeStop(ev.id))}
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
              {st && stopFields(ev.id, ev.title, st)}
              {st && gap(ev.id)}
              {momentStopsUnder(ev.id).map((mo) => {
                const mst = stopOf(mo.id)!;
                return (
                  <div key={mo.id} className={s.momentRow}>
                    <label className={s.rowPick}>
                      <input type="checkbox" checked onChange={() => removeStop(mo.id)} />
                      {mo.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mo.thumb} alt="" className={s.rowThumb} />
                      ) : (
                        <span className={s.rowThumbEmpty} />
                      )}
                      <span className={s.rowTitle}>
                        {mo.title}
                        <span className={s.rowMeta}>moment in {ev.title}</span>
                      </span>
                    </label>
                    {stopFields(mo.id, mo.title, mst)}
                    {gap(mo.id)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {state && "error" in state && <p className={f.error}>{state.error}</p>}
      <div className={s.saveRow}>
        <button type="submit" className={f.submit} disabled={pending || !!upload}>
          {pending ? "Saving…" : `Save script · ${stopCount} stop${stopCount === 1 ? "" : "s"}`}
        </button>
        {state && "ok" in state && !pending && (
          <span className={s.audioNote}>Saved. The timeline has the new script.</span>
        )}
      </div>
    </form>
  );
}
