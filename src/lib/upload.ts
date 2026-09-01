// Shared constants for the direct-to-storage upload pipeline.
export const ACCEPTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
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
