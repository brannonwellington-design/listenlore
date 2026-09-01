"use client";

import { useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { createMoments } from "@/app/add/actions";
import type { Option } from "@/components/MomentForm";
import TagPicker from "@/components/TagPicker";
import { usePhotoUploads, type UploadEntry } from "@/components/usePhotoUploads";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_BULK_MOMENTS,
  MAX_BULK_PHOTOS,
  MAX_PHOTOS_PER_MOMENT,
} from "@/lib/upload";
import f from "../form.module.css";
import s from "./bulk.module.css";

interface Draft {
  key: string;
  title: string;
  body: string;
  category_id: string;
  milestone_id: string;
  event_date: string;
  date_precision: string;
  location: string;
  photoKeys: string[];
}

let draftCounter = 0;
const newDraft = (photoKeys: string[] = []): Draft => ({
  key: `d${draftCounter++}`,
  title: "",
  body: "",
  category_id: "",
  milestone_id: "",
  event_date: "",
  date_precision: "day",
  location: "",
  photoKeys,
});

export default function BulkComposer({
  categories,
  milestones,
  people,
}: {
  categories: Option[];
  milestones: Option[];
  people: Option[];
}) {
  const uploads = usePhotoUploads(MAX_BULK_PHOTOS);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [stage, setStage] = useState<"drop" | "choose" | "compose">("drop");
  const [pendingChoice, setPendingChoice] = useState<UploadEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaults, setDefaults] = useState({
    category_id: "",
    milestone_id: "",
    event_date: "",
    date_precision: "day",
    location: "",
  });
  const [tags, setTags] = useState<{ ids: string[]; newNames: string[] }>({
    ids: [],
    newNames: [],
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, formAction, submitting] = useActionState(createMoments, null);
  const [, startTransition] = useTransition();

  const entryByKey = new Map(uploads.entries.map((e) => [e.key, e]));

  const handleDrop = async (files: FileList | File[] | null) => {
    const fresh = await uploads.addFiles(files);
    if (fresh.length === 0) return;
    if (stage === "drop") {
      setPendingChoice(fresh);
      setStage("choose");
    } else {
      // Already composing: each new photo arrives as its own card.
      setDrafts((prev) => [...prev, ...fresh.map((e) => newDraft([e.key]))]);
    }
  };

  const choose = (mode: "one" | "many") => {
    const keys = pendingChoice.map((e) => e.key);
    setDrafts(
      mode === "one" ? [newDraft(keys)] : keys.map((k) => newDraft([k]))
    );
    setPendingChoice([]);
    setStage("compose");
  };

  const patchDraft = (key: string, changes: Partial<Draft>) =>
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...changes } : d))
    );

  const applyDefaults = () =>
    setDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        category_id: defaults.category_id || d.category_id,
        milestone_id: defaults.milestone_id || d.milestone_id,
        event_date: defaults.event_date || d.event_date,
        date_precision: defaults.event_date
          ? defaults.date_precision
          : d.date_precision,
        location: defaults.location || d.location,
      }))
    );

  const mergeSelected = () => {
    const keys = drafts.filter((d) => selected.has(d.key)).map((d) => d.key);
    if (keys.length < 2) return;
    setDrafts((prev) => {
      const chosen = prev.filter((d) => keys.includes(d.key));
      const target: Draft = {
        ...chosen[0],
        photoKeys: chosen.flatMap((d) => d.photoKeys),
        title: chosen.map((d) => d.title).find((t) => t.trim()) ?? "",
      };
      const rest = prev.filter((d) => !keys.includes(d.key));
      const at = prev.findIndex((d) => d.key === keys[0]);
      rest.splice(Math.min(at, rest.length), 0, target);
      return rest;
    });
    setSelected(new Set());
  };

  const splitDraft = (key: string) =>
    setDrafts((prev) =>
      prev.flatMap((d) => {
        if (d.key !== key || d.photoKeys.length < 2) return [d];
        return d.photoKeys.map((pk, i) => ({
          ...newDraft([pk]),
          ...(i === 0 ? { title: d.title, body: d.body } : {}),
          category_id: d.category_id,
          milestone_id: d.milestone_id,
          event_date: d.event_date,
          date_precision: d.date_precision,
          location: d.location,
        }));
      })
    );

  const removeDraft = (key: string) => {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const removePhoto = (draftKey: string, photoKey: string) => {
    patchDraft(draftKey, {
      photoKeys:
        drafts
          .find((d) => d.key === draftKey)
          ?.photoKeys.filter((k) => k !== photoKey) ?? [],
    });
    uploads.remove(photoKey);
  };

  const titlesMissing = drafts.filter((d) => !d.title.trim()).length;
  const canSubmit =
    drafts.length > 0 &&
    drafts.length <= MAX_BULK_MOMENTS &&
    titlesMissing === 0 &&
    !uploads.pending &&
    !submitting;

  const submit = () => {
    const payload = {
      tagged: tags.ids,
      tagged_new: tags.newNames,
      moments: drafts.map((d) => ({
        title: d.title,
        body: d.body || undefined,
        category_id: d.category_id || undefined,
        milestone_id: d.milestone_id || undefined,
        event_date: d.event_date || undefined,
        date_precision: d.date_precision,
        location: d.location || undefined,
        photos: d.photoKeys
          .map((k) => entryByKey.get(k)?.uploaded)
          .filter((u): u is NonNullable<typeof u> => !!u),
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  };

  /* ---------------- stages ---------------- */

  if (stage === "drop" || stage === "choose") {
    return (
      <div>
        {stage === "drop" && (
          <div
            className={`${s.dropZone} ${dragOver ? s.dropZoneActive : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleDrop(e.dataTransfer.files);
            }}
          >
            <div className={s.dropTitle}>Drop photos here</div>
            <div className={s.dropNote}>
              Up to {MAX_BULK_PHOTOS} at once. They upload right away while you
              write. Or start with{" "}
              <button
                type="button"
                className={s.toolBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setDrafts([newDraft()]);
                  setStage("compose");
                }}
              >
                empty moments
              </button>{" "}
              instead.
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={Object.keys(ACCEPTED_IMAGE_TYPES).join(",")}
              multiple
              hidden
              onChange={(e) => {
                handleDrop(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}
        {stage === "choose" && (
          <div>
            <div className={s.dropTitle}>
              {pendingChoice.length} photo{pendingChoice.length === 1 ? "" : "s"} —
              how should they land?
            </div>
            <div className={s.choice}>
              <button type="button" className={s.choiceBtn} onClick={() => choose("one")}>
                <span className={s.choiceTitle}>One moment, all the photos</span>
                <span className={s.choiceNote}>
                  A single memory with {pendingChoice.length} photos attached. One
                  title, one story.
                </span>
              </button>
              <button type="button" className={s.choiceBtn} onClick={() => choose("many")}>
                <span className={s.choiceTitle}>
                  {pendingChoice.length} separate moments
                </span>
                <span className={s.choiceNote}>
                  Each photo becomes its own memory — fastest way to fill in a lot
                  of history. You can merge some together afterwards.
                </span>
              </button>
            </div>
          </div>
        )}
        {uploads.warning && <p className={s.error}>{uploads.warning}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className={s.defaultsBar}>
        <div className={s.defaultsTitle}>Shared details</div>
        <div className={s.defaultsNote}>
          Fill these once and apply to every card — each card stays individually
          editable. People tagged here go on all the moments in this batch.
        </div>
        <div className={s.defaultsRow}>
          <label className={s.defaultsField}>
            <span className={f.label}>Milestone</span>
            <select
              className={f.input}
              value={defaults.milestone_id}
              onChange={(e) => setDefaults({ ...defaults, milestone_id: e.target.value })}
            >
              <option value="">—</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className={s.defaultsField}>
            <span className={f.label}>Category</span>
            <select
              className={f.input}
              value={defaults.category_id}
              onChange={(e) => setDefaults({ ...defaults, category_id: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={s.defaultsField}>
            <span className={f.label}>Date</span>
            <input
              type="date"
              className={f.input}
              value={defaults.event_date}
              onChange={(e) => setDefaults({ ...defaults, event_date: e.target.value })}
            />
          </label>
          <label className={s.defaultsField}>
            <span className={f.label}>How exact?</span>
            <select
              className={f.input}
              value={defaults.date_precision}
              onChange={(e) =>
                setDefaults({ ...defaults, date_precision: e.target.value })
              }
            >
              <option value="day">That exact day</option>
              <option value="month">Sometime that month</option>
              <option value="approx">Rough guess</option>
            </select>
          </label>
          <label className={s.defaultsField}>
            <span className={f.label}>Where</span>
            <input
              className={f.input}
              value={defaults.location}
              onChange={(e) => setDefaults({ ...defaults, location: e.target.value })}
              placeholder="San Francisco"
            />
          </label>
          <button type="button" className={s.applyBtn} onClick={applyDefaults}>
            Apply to all cards
          </button>
        </div>
        <TagPicker people={people} onChange={setTags} />
      </div>

      <div className={s.toolbar}>
        <span className={s.toolCount}>
          {drafts.length} moment{drafts.length === 1 ? "" : "s"}
          {titlesMissing > 0 ? ` · ${titlesMissing} missing a title` : ""}
        </span>
        <button
          type="button"
          className={s.toolBtn}
          disabled={selected.size < 2}
          onClick={mergeSelected}
        >
          Merge selected ({selected.size})
        </button>
        <button
          type="button"
          className={s.toolBtn}
          onClick={() => setDrafts((prev) => [...prev, newDraft()])}
        >
          + Empty moment
        </button>
        <button
          type="button"
          className={s.toolBtn}
          onClick={() => fileInput.current?.click()}
        >
          + More photos
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={Object.keys(ACCEPTED_IMAGE_TYPES).join(",")}
          multiple
          hidden
          onChange={(e) => {
            handleDrop(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className={s.grid}>
        {drafts.map((d) => (
          <div
            key={d.key}
            className={`${s.card} ${selected.has(d.key) ? s.cardSelected : ""}`}
          >
            <div className={s.cardHead}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(d.key)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(d.key);
                    else next.delete(d.key);
                    setSelected(next);
                  }}
                />
                Select
              </label>
              {d.photoKeys.length > 1 && (
                <button type="button" className={s.split} onClick={() => splitDraft(d.key)}>
                  Split into {d.photoKeys.length}
                </button>
              )}
              <button
                type="button"
                className={s.cardRemove}
                onClick={() => removeDraft(d.key)}
              >
                Remove
              </button>
            </div>
            {d.photoKeys.length > 0 && (
              <div className={s.cardPhotos}>
                {d.photoKeys.map((pk) => {
                  const e = entryByKey.get(pk);
                  if (!e) return null;
                  return (
                    <div key={pk} className={s.cardPhoto}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.previewUrl}
                        alt={e.name}
                        className={`${s.cardPhotoImg} ${e.status !== "done" ? s.cardPhotoDim : ""}`}
                      />
                      {e.status === "uploading" && (
                        <div className={s.cardProgress}>
                          {Math.round(e.progress * 100)}%
                        </div>
                      )}
                      {e.status === "error" && (
                        <div className={s.error}>failed</div>
                      )}
                      <button
                        type="button"
                        className={s.cardPhotoRemove}
                        aria-label="Remove photo"
                        onClick={() => removePhoto(d.key, pk)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <input
              className={f.input}
              placeholder="Title (required)"
              maxLength={200}
              value={d.title}
              onChange={(e) => patchDraft(d.key, { title: e.target.value })}
            />
            <textarea
              className={f.input}
              placeholder="The story (optional)"
              rows={2}
              maxLength={4000}
              value={d.body}
              onChange={(e) => patchDraft(d.key, { body: e.target.value })}
            />
            <div className={s.defaultsRow}>
              <label className={s.defaultsField}>
                <span className={f.label}>Milestone</span>
                <select
                  className={f.input}
                  value={d.milestone_id}
                  onChange={(e) => patchDraft(d.key, { milestone_id: e.target.value })}
                >
                  <option value="">—</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={s.defaultsField}>
                <span className={f.label}>Date</span>
                <input
                  type="date"
                  className={f.input}
                  value={d.event_date}
                  onChange={(e) => patchDraft(d.key, { event_date: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className={s.footer}>
        <button
          type="button"
          className={f.submit}
          disabled={!canSubmit}
          onClick={submit}
        >
          {submitting
            ? "Creating…"
            : uploads.pending
              ? "Uploading photos…"
              : `Create ${drafts.length} moment${drafts.length === 1 ? "" : "s"}`}
        </button>
        {titlesMissing > 0 && (
          <span className={s.footerNote}>
            {titlesMissing} card{titlesMissing === 1 ? " still needs" : "s still need"} a title.
          </span>
        )}
        {drafts.length > MAX_BULK_MOMENTS && (
          <span className={s.error}>
            Up to {MAX_BULK_MOMENTS} moments per batch — merge or remove some.
          </span>
        )}
        {drafts.some((d) => d.photoKeys.length > MAX_PHOTOS_PER_MOMENT) && (
          <span className={s.error}>
            A moment can hold up to {MAX_PHOTOS_PER_MOMENT} photos.
          </span>
        )}
        {state?.error && <span className={s.error}>{state.error}</span>}
        {uploads.warning && <span className={s.error}>{uploads.warning}</span>}
      </div>
    </div>
  );
}
