import "server-only";
import { serviceClient } from "./supabase/service";

// The walkthrough script lives as one JSON document in the media bucket,
// beside the narration track, so it needs no schema change: which events
// the tour stops on, when in the recording each one begins, and what is
// said there.
export interface WalkthroughStop {
  id: string; // milestone id
  at: number; // seconds into the narration
  text: string;
}

export interface WalkthroughScript {
  version: 1;
  audioPath: string | null;
  stops: WalkthroughStop[];
}

export interface Walkthrough extends WalkthroughScript {
  audioUrl: string | null;
}

export const SCRIPT_PATH = "walkthrough/script.json";
export const AUDIO_PREFIX = "walkthrough/";

const EMPTY: WalkthroughScript = { version: 1, audioPath: null, stops: [] };

function sanitize(raw: unknown): WalkthroughScript {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as Partial<WalkthroughScript>;
  const stops = Array.isArray(r.stops)
    ? r.stops
        .filter((s) => s && typeof s.id === "string")
        .map((s) => ({
          id: String(s.id),
          at: Number.isFinite(Number(s.at)) ? Math.max(0, Number(s.at)) : 0,
          text: typeof s.text === "string" ? s.text.slice(0, 2000) : "",
        }))
    : [];
  const audioPath =
    typeof r.audioPath === "string" && r.audioPath.startsWith(AUDIO_PREFIX)
      ? r.audioPath
      : null;
  return { version: 1, audioPath, stops };
}

export async function getWalkthrough(): Promise<Walkthrough> {
  const db = serviceClient();
  let script = EMPTY;
  try {
    const { data } = await db.storage.from("media").download(SCRIPT_PATH);
    if (data) script = sanitize(JSON.parse(await data.text()));
  } catch {
    script = EMPTY;
  }
  let audioUrl: string | null = null;
  if (script.audioPath) {
    const { data } = await db.storage
      .from("media")
      .createSignedUrl(script.audioPath, 60 * 60 * 24);
    audioUrl = data?.signedUrl ?? null;
  }
  return { ...script, audioUrl };
}

export async function saveWalkthrough(
  script: WalkthroughScript
): Promise<{ error?: string }> {
  const db = serviceClient();
  const clean = sanitize(script);
  const body = new Blob([JSON.stringify(clean)], { type: "application/json" });
  const { error } = await db.storage
    .from("media")
    .upload(SCRIPT_PATH, body, { upsert: true, contentType: "application/json" });
  return error ? { error: error.message } : {};
}
