// Shared constants for the direct-to-storage upload pipeline.
export const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const ACCEPTED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Storage bucket caps files at 50 MB; videos get the full allowance.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)$/i;
export const MAX_PHOTOS_PER_MOMENT = 12;
export const MAX_BULK_PHOTOS = 30;
export const MAX_BULK_MOMENTS = 20;

export interface UploadTicket {
  path: string;
  token: string;
}

export interface UploadedPhoto {
  path: string;
  width: number | null;
  height: number | null;
}
