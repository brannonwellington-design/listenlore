"use client";

import { useCallback, useRef, useState } from "react";
import { requestUploadTickets } from "@/app/add/actions";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_BYTES,
  type UploadedPhoto,
} from "@/lib/upload";
import { readImageSize, uploadToStorage } from "@/lib/upload-client";

export interface UploadEntry {
  key: string;
  name: string;
  previewUrl: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  uploaded?: UploadedPhoto;
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
      for (const file of Array.from(files)) {
        if (current + accepted.length >= maxCount) {
          setWarning(`Up to ${maxCount} photos here — the rest were left out.`);
          break;
        }
        if (!ACCEPTED_IMAGE_TYPES[file.type]) {
          setWarning(
            `“${file.name}” isn’t a supported image (JPEG, PNG, WebP, or GIF — iPhone HEIC photos need exporting as JPEG).`
          );
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setWarning(`“${file.name}” is over 10 MB.`);
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length === 0) return [];

      const fresh: UploadEntry[] = accepted.map((file) => ({
        key: `u${counter.current++}`,
        name: file.name,
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
            const dims = await readImageSize(file);
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
