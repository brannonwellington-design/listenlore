"use client";

import { useCallback, useRef, useState } from "react";
import { requestUploadTickets } from "@/app/add/actions";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_FILE_BYTES,
  MAX_VIDEO_BYTES,
  type UploadedPhoto,
} from "@/lib/upload";
import { readImageSize, uploadToStorage } from "@/lib/upload-client";

export interface UploadEntry {
  key: string;
  name: string;
  kind: "image" | "video";
  previewUrl: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  uploaded?: UploadedPhoto;
}

// iPhone photos arrive as HEIC, which browsers can pick but storage
// shouldn't keep — convert to JPEG in the browser before the normal
// pipeline. The converter (wasm) loads lazily, only when a HEIC shows up.
function isHeic(file: File): boolean {
  return (
    /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
  );
}

async function heicToJpeg(file: File): Promise<File | null> {
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(out) ? out[0] : out;
    const name = `${file.name.replace(/\.hei[cf]$/i, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return null;
  }
}

// Owns the whole client upload pipeline: validate, mint tickets, PUT
// directly to storage with progress, and expose the finished photo refs.
export function usePhotoUploads(maxCount: number) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const counter = useRef(0);

  const patch = useCallback((key: string, changes: Partial<UploadEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...changes } : e))
    );
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[] | null): Promise<UploadEntry[]> => {
      if (!files) return [];
      setWarning(null);

      const current = entries.length;
      const accepted: File[] = [];
      for (let file of Array.from(files)) {
        if (current + accepted.length >= maxCount) {
          setWarning(`Up to ${maxCount} photos here — the rest were left out.`);
          break;
        }
        if (isHeic(file)) {
          const converted = await heicToJpeg(file);
          if (!converted) {
            setWarning(
              `Couldn’t convert “${file.name}” — try exporting it as JPEG.`
            );
            continue;
          }
          file = converted;
        }
        const isVideo = !!ACCEPTED_VIDEO_TYPES[file.type];
        if (!ACCEPTED_IMAGE_TYPES[file.type] && !isVideo) {
          setWarning(
            `“${file.name}” isn’t supported (photos: JPEG, PNG, WebP, GIF, HEIC; videos: MP4, MOV, WebM).`
          );
          continue;
        }
        if (isVideo ? file.size > MAX_VIDEO_BYTES : file.size > MAX_FILE_BYTES) {
          setWarning(
            `“${file.name}” is over ${isVideo ? "50" : "10"} MB.`
          );
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length === 0) return [];

      const fresh: UploadEntry[] = accepted.map((file) => ({
        key: `u${counter.current++}`,
        name: file.name,
        kind: ACCEPTED_VIDEO_TYPES[file.type] ? ("video" as const) : ("image" as const),
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: "uploading" as const,
      }));
      setEntries((prev) => [...prev, ...fresh]);

      const ticketRes = await requestUploadTickets(
        accepted.map((f) => ({ type: f.type, size: f.size }))
      );
      if ("error" in ticketRes) {
        setEntries((prev) =>
          prev.map((e) =>
            fresh.some((f) => f.key === e.key)
              ? { ...e, status: "error", error: ticketRes.error }
              : e
          )
        );
        return fresh;
      }

      await Promise.all(
        accepted.map(async (file, i) => {
          const entry = fresh[i];
          const ticket = ticketRes.tickets[i];
          try {
            const dims = ACCEPTED_VIDEO_TYPES[file.type]
              ? { width: null, height: null }
              : await readImageSize(file);
            await uploadToStorage(ticket, file, (fraction) =>
              patch(entry.key, { progress: fraction })
            );
            patch(entry.key, {
              status: "done",
              progress: 1,
              uploaded: { path: ticket.path, ...dims },
            });
          } catch (err) {
            patch(entry.key, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            });
          }
        })
      );
      return fresh;
    },
    [entries.length, maxCount, patch]
  );

  const remove = useCallback((key: string) => {
    setEntries((prev) => {
      const gone = prev.find((e) => e.key === key);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((e) => e.key !== key);
    });
    setWarning(null);
  }, []);

  const clear = useCallback(() => {
    setEntries((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.previewUrl));
      return [];
    });
    setWarning(null);
  }, []);

  const pending = entries.some((e) => e.status === "uploading");
  const failed = entries.filter((e) => e.status === "error");
  const done = entries.filter(
    (e): e is UploadEntry & { uploaded: UploadedPhoto } =>
      e.status === "done" && !!e.uploaded
  );

  return { entries, addFiles, remove, clear, warning, pending, failed, done };
}
