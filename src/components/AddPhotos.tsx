"use client";

import { useActionState, useEffect, useState } from "react";
import { addPhotosToMoment } from "@/app/add/actions";
import { MAX_PHOTOS_PER_MOMENT } from "@/lib/upload";
import s from "./form.module.css";
import PhotoPicker from "./PhotoPicker";
import { usePhotoUploads } from "./usePhotoUploads";

// Owner/admin affordance on a moment's page: top up its photos without
// going through the full edit form.
export default function AddPhotos({
  momentId,
  remaining,
}: {
  momentId: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const uploads = usePhotoUploads(Math.max(remaining, 0));
  const [state, formAction, pending] = useActionState(addPhotosToMoment, null);

  useEffect(() => {
    if (state && "ok" in state) {
      // Deferred a frame: closing the picker is a reaction to the action's
      // result, not part of this render pass.
      requestAnimationFrame(() => {
        uploads.clear();
        setOpen(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (remaining <= 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 14,
          lineHeight: "20px",
          color: "var(--content-brand)",
          textDecoration: "underline",
        }}
      >
        Add photos
      </button>
    );
  }

  return (
    <form action={formAction} style={{ maxWidth: 640 }}>
      <input type="hidden" name="moment_id" value={momentId} />
      <PhotoPicker uploads={uploads} maxCount={remaining} />
      {state && "error" in state && <p className={s.error}>{state.error}</p>}
      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <button
          type="submit"
          className={s.submit}
          disabled={pending || uploads.pending || uploads.done.length === 0}
        >
          {uploads.pending
            ? "Uploading…"
            : pending
              ? "Saving…"
              : `Save ${uploads.done.length} photo${uploads.done.length === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => {
            uploads.clear();
            setOpen(false);
          }}
          style={{ fontSize: 14, color: "var(--content-secondary)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
