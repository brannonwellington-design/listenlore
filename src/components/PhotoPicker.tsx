"use client";

import s from "./form.module.css";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/upload";
import type { usePhotoUploads } from "./usePhotoUploads";

// Photo input with live direct-to-storage uploads: previews, per-photo
// progress, client-side validation, and removal. State lives in the
// usePhotoUploads hook (owned by the form so it can gate submission);
// finished uploads are serialized as hidden inputs.
export default function PhotoPicker({
  uploads,
  maxCount,
}: {
  uploads: ReturnType<typeof usePhotoUploads>;
  maxCount: number;
}) {
  return (
    <div className={s.field}>
      <span className={s.label}>
        Photos (optional — up to {maxCount}, JPEG/PNG/WebP/GIF)
      </span>
      {uploads.entries.length > 0 && (
        <div className={s.previewGrid}>
          {uploads.entries.map((e) => (
            <div key={e.key} className={s.previewItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={e.previewUrl}
                alt={e.name}
                className={s.previewImg}
                style={e.status !== "done" ? { opacity: 0.55 } : undefined}
              />
              {e.status === "uploading" && (
                <span className={s.previewStatus}>
                  Uploading… {Math.round(e.progress * 100)}%
                </span>
              )}
              {e.status === "error" && (
                <span className={s.error}>{e.error ?? "Upload failed"}</span>
              )}
              <button
                type="button"
                className={s.previewRemove}
                onClick={() => uploads.remove(e.key)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        type="file"
        accept={Object.keys(ACCEPTED_IMAGE_TYPES).join(",")}
        multiple
        className={s.input}
        onChange={(e) => {
          uploads.addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {uploads.warning && <p className={s.error}>{uploads.warning}</p>}
      {uploads.done.map((e) => (
        <input
          key={e.key}
          type="hidden"
          name="uploaded"
          value={JSON.stringify(e.uploaded)}
        />
      ))}
    </div>
  );
}
