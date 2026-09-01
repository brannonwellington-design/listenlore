"use client";

import { useActionState } from "react";
import s from "./form.module.css";
import PhotoPicker from "./PhotoPicker";
import TagPicker from "./TagPicker";

export interface Option {
  id: string;
  label: string;
}

export interface MomentDefaults {
  moment_id?: string;
  title?: string;
  body?: string;
  category_id?: string;
  milestone_id?: string;
  event_date?: string;
  date_precision?: string;
  location?: string;
  tagged?: string[];
}

export default function MomentForm({
  action,
  categories,
  milestones,
  people,
  defaults = {},
  submitLabel,
}: {
  action: (
    prev: { error: string } | null,
    formData: FormData
  ) => Promise<{ error: string } | null>;
  categories: Option[];
  milestones: Option[];
  people: Option[];
  defaults?: MomentDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={s.form}>
      {defaults.moment_id && (
        <input type="hidden" name="moment_id" value={defaults.moment_id} />
      )}

      <label className={s.field}>
        <span className={s.label}>Title</span>
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={defaults.title}
          className={s.input}
          placeholder="What happened?"
        />
      </label>

      <label className={s.field}>
        <span className={s.label}>The story (optional)</span>
        <textarea
          name="body"
          rows={4}
          maxLength={4000}
          defaultValue={defaults.body}
          className={s.input}
          placeholder="Details worth remembering…"
        />
      </label>

      <div className={s.row}>
        <label className={s.field}>
          <span className={s.label}>Category</span>
          <select
            name="category_id"
            defaultValue={defaults.category_id ?? ""}
            className={s.input}
          >
            <option value="">Pick one…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span className={s.label}>Part of a milestone? (optional)</span>
          <select
            name="milestone_id"
            defaultValue={defaults.milestone_id ?? ""}
            className={s.input}
          >
            <option value="">No — it stands on its own</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.row}>
        <label className={s.field}>
          <span className={s.label}>When (optional)</span>
          <input
            type="date"
            name="event_date"
            defaultValue={defaults.event_date}
            className={s.input}
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>How exact is that date?</span>
          <select
            name="date_precision"
            defaultValue={defaults.date_precision ?? "day"}
            className={s.input}
          >
            <option value="day">That exact day</option>
            <option value="month">Sometime that month</option>
            <option value="approx">Rough guess</option>
          </select>
        </label>

        <label className={s.field}>
          <span className={s.label}>Where (optional)</span>
          <input
            name="location"
            maxLength={120}
            defaultValue={defaults.location}
            className={s.input}
            placeholder="San Francisco"
          />
        </label>
      </div>

      <TagPicker people={people} defaults={defaults.tagged} />

      <PhotoPicker />

      {state?.error && <p className={s.error}>{state.error}</p>}

      <button type="submit" disabled={pending} className={s.submit}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
