import "server-only";
import { serviceClient } from "./supabase/service";
import {
  EMPTY_SCRIPT,
  sanitizeScript,
  type WalkthroughScript,
} from "./walkthrough-script";

export type { ScriptItem, WalkthroughScript } from "./walkthrough-script";

// The walkthrough script lives as one JSON document in the media bucket,
// beside the narration track, so it needs no schema change: the ordered
// list of what the tour does (stops on events, wanders through other
// views, waits), and when in the recording each stop begins.
export interface Walkthrough extends WalkthroughScript {
  audioUrl: string | null;
}

export const SCRIPT_PATH = "walkthrough/script.json";
export const AUDIO_PREFIX = "walkthrough/";

export async function getWalkthrough(): Promise<Walkthrough> {
  const db = serviceClient();
  let script = EMPTY_SCRIPT;
  try {
    const { data } = await db.storage.from("media").download(SCRIPT_PATH);
    if (data) script = sanitizeScript(JSON.parse(await data.text()), AUDIO_PREFIX);
  } catch {
    script = EMPTY_SCRIPT;
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

export async function saveWalkthrough(raw: unknown): Promise<{ error?: string }> {
  const db = serviceClient();
  const clean = sanitizeScript(raw, AUDIO_PREFIX);
  const body = new Blob([JSON.stringify(clean)], { type: "application/json" });
  const { error } = await db.storage
    .from("media")
    .upload(SCRIPT_PATH, body, { upsert: true, contentType: "application/json" });
  return error ? { error: error.message } : {};
}
