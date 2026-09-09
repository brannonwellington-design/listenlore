"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import {
  ACCEPTED_AUDIO_TYPES,
  MAX_AUDIO_BYTES,
  type UploadTicket,
} from "@/lib/upload";
import {
  AUDIO_PREFIX,
  saveWalkthrough,
  type WalkthroughScript,
} from "@/lib/walkthrough";

// One signed ticket for the narration track, straight to storage.
export async function requestAudioUploadTicket(file: {
  type: string;
  size: number;
}): Promise<{ ticket: UploadTicket } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Sign in to upload the narration." };
  const ext = ACCEPTED_AUDIO_TYPES[file.type];
  if (!ext) return { error: "Use an MP3, M4A, WAV, OGG or WebM audio file." };
  if (file.size > MAX_AUDIO_BYTES) return { error: "The track must be under 50 MB." };

  const path = `${AUDIO_PREFIX}narration-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await serviceClient()
    .storage.from("media")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: `Couldn’t prepare the upload: ${error?.message}` };
  return { ticket: { path: data.path, token: data.token } };
}

// Any signed-in employee may shape the tour.
export async function saveWalkthroughScript(
  _prev: { error: string } | { ok: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/walkthrough/edit");

  let payload: WalkthroughScript;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The script looked malformed — try again." };
  }
  const result = await saveWalkthrough(payload);
  if (result.error) return { error: `Couldn’t save: ${result.error}` };

  revalidatePath("/");
  revalidatePath("/walkthrough/edit");
  return { ok: true };
}
