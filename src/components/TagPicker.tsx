"use client";

import { useMemo, useRef, useState } from "react";
import s from "./form.module.css";
import type { Option } from "./MomentForm";

interface Tag {
  id?: string; // existing person id; absent for a newly typed name
  label: string;
}

// Type-ahead people tagging: filters the roster as you type, and lets
// you tag someone who isn't in it yet by adding their name.
export default function TagPicker({
  people,
  defaults = [],
  onChange,
}: {
  people: Option[];
  defaults?: string[];
  onChange?: (selection: { ids: string[]; newNames: string[] }) => void;
}) {
  const [tags, setTagsRaw] = useState<Tag[]>(
    people.filter((p) => defaults.includes(p.id)).map((p) => ({ id: p.id, label: p.label }))
  );
  const setTags = (update: (prev: Tag[]) => Tag[]) => {
    setTagsRaw((prev) => {
      const next = update(prev);
      onChange?.({
        ids: next.filter((t) => t.id).map((t) => t.id!),
        newNames: next.filter((t) => !t.id).map((t) => t.label),
      });
      return next;
    });
  };
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !tags.some((t) => t.id === p.id))
      .filter((p) => !q || p.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [people, tags, query]);

  const exactMatch = people.some(
    (p) => p.label.toLowerCase() === query.trim().toLowerCase()
  );
  const canAddNew =
    query.trim().length > 1 &&
    !exactMatch &&
    !tags.some((t) => t.label.toLowerCase() === query.trim().toLowerCase());

  const addTag = (tag: Tag) => {
    setTags((prev) => [...prev, tag]);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className={s.field}>
      <span className={s.label}>Who was part of it? (optional)</span>
      {tags.length > 0 && (
        <div className={s.chipRow}>
          {tags.map((t) => (
            <span key={t.id ?? t.label} className={s.chip}>
              {t.label}
              <button
                type="button"
                className={s.chipRemove}
                aria-label={`Remove ${t.label}`}
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {tags.map((t) =>
        t.id ? (
          <input key={t.id} type="hidden" name="tagged" value={t.id} />
        ) : (
          <input key={t.label} type="hidden" name="tagged_new" value={t.label} />
        )
      )}
      <div className={s.comboWrap}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions.length > 0) addTag({ id: suggestions[0].id, label: suggestions[0].label });
              else if (canAddNew) addTag({ label: query.trim() });
            }
          }}
          className={s.input}
          placeholder="Start typing a name…"
          aria-label="Tag people"
        />
        {open && (suggestions.length > 0 || canAddNew) && (
          <div className={s.comboList}>
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                className={s.comboItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag({ id: p.id, label: p.label })}
              >
                {p.label}
              </button>
            ))}
            {canAddNew && (
              <button
                type="button"
                className={s.comboItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag({ label: query.trim() })}
              >
                Add “{query.trim()}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
