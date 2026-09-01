"use client";

import { useEffect, useRef, useState } from "react";
import s from "./form.module.css";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Picked {
  file: File;
  url: string;
}

// Photo input with previews, client-side validation, and per-photo
// removal. Selected files survive server-side validation errors because
// they live in state and are re-synced into the real input.
export default function PhotoPicker() {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    picked.forEach((p) => dt.items.add(p.file));
    input.files = dt.files;
  }, [picked]);

  useEffect(
    () => () => picked.forEach((p) => URL.revokeObjectURL(p.url)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const add = (files: FileList | null) => {
    if (!files) return;
    setWarning(null);
    const next = [...picked];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_FILES) {
        setWarning(`Up to ${MAX_FILES} photos per moment — the rest were left out.`);
        break;
      }
      if (!ACCEPTED.includes(file.type)) {
        setWarning(
          `“${file.name}” isn’t a supported image (JPEG, PNG, WebP, or GIF — iPhone HEIC photos need exporting as JPEG).`
        );
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setWarning(`“${file.name}” is over 10 MB.`);
        continue;
      }
      if (next.some((p) => p.file.name === file.name && p.file.size === file.size)) {
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPicked(next);
  };

  const remove = (url: string) => {
    setPicked((prev) => {
      const gone = prev.find((p) => p.url === url);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.url !== url);
    });
    setWarning(null);
  };

  return (
    <div className={s.field}>
      <span className={s.label}>
        Photos (optional — up to {MAX_FILES}, JPEG/PNG/WebP/GIF)
      </span>
      {picked.length > 0 && (
        <div className={s.previewGrid}>
          {picked.map((p) => (
            <div key={p.url} className={s.previewItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.file.name} className={s.previewImg} />
              <button
                type="button"
                className={s.previewRemove}
                onClick={() => remove(p.url)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept={ACCEPTED.join(",")}
        multiple
        className={s.input}
        onChange={(e) => {
          add(e.target.files);
          // the effect re-syncs input.files from state, so clearing here
          // avoids double-adding when the same file is picked twice
        }}
      />
      {warning && <p className={s.error}>{warning}</p>}
    </div>
  );
}
