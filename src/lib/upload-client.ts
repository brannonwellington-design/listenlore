"use client";

import type { UploadTicket } from "./upload";

// PUT the file straight to Supabase storage using a signed upload token,
// bypassing the app server entirely (no request-size ceiling, real progress).
export function uploadToStorage(
  ticket: UploadTicket,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const path = ticket.path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const url = `${base}/storage/v1/object/upload/sign/media/${path}?token=${encodeURIComponent(ticket.token)}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader(
      "apikey",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed (network)"));
    xhr.send(file);
  });
}

// Read a photo's pixel dimensions in the browser before upload.
export function readImageSize(
  file: File
): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
