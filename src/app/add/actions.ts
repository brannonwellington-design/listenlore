"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { imageSize } from "image-size";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { getViewer } from "@/lib/auth";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function readFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const category_id = String(formData.get("category_id") ?? "") || null;
  const milestone_id = String(formData.get("milestone_id") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const event_date = String(formData.get("event_date") ?? "") || null;
  const precision = String(formData.get("date_precision") ?? "approx");
  const tagged = formData
    .getAll("tagged")
    .map(String)
    .filter((v) => v.length > 0);
  const taggedNew = formData
    .getAll("tagged_new")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 1 && v.length <= 80);
  return {
    title,
    body,
    category_id,
    milestone_id,
    location,
    event_date,
    date_precision: ["day", "month", "year", "approx"].includes(precision)
      ? precision
      : "approx",
    tagged,
    taggedNew,
  };
}

// Resolve typed-in names to people rows, creating any that don't exist,
// and return the full set of person ids to tag.
async function resolveTagged(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
  newNames: string[]
): Promise<string[]> {
  const all = new Set(ids);
  for (const name of newNames) {
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .ilike("full_name", name)
      .maybeSingle();
    if (existing) {
      all.add(existing.id);
      continue;
    }
    const { data: created } = await supabase
      .from("people")
      .insert({ full_name: name })
      .select("id")
      .single();
    if (created) all.add(created.id);
  }
  return [...all];
}

function collectFiles(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
}

function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `At most ${MAX_FILES} photos per moment.`;
  for (const f of files) {
    if (!IMAGE_TYPES[f.type]) {
      return `“${f.name}” isn’t a supported image. Use JPEG, PNG, WebP, or GIF (iPhone HEIC photos need to be exported as JPEG first).`;
    }
    if (f.size > MAX_FILE_BYTES) return `“${f.name}” is over 10 MB.`;
  }
  return null;
}

interface Uploaded {
  storage_path: string;
  sort: number;
  width: number | null;
  height: number | null;
}

async function uploadFiles(
  momentId: string,
  files: File[],
  startSort: number
): Promise<Uploaded[]> {
  const service = serviceClient();
  const out: Uploaded[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = IMAGE_TYPES[f.type];
    const path = `moments/${momentId}/${Date.now()}-${i}.${ext}`;
    const buffer = Buffer.from(await f.arrayBuffer());
    let width: number | null = null;
    let height: number | null = null;
    try {
      const dim = imageSize(buffer);
      width = dim.width ?? null;
      height = dim.height ?? null;
    } catch {}
    const { error } = await service.storage
      .from("media")
      .upload(path, buffer, { contentType: f.type, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    out.push({ storage_path: path, sort: startSort + i, width, height });
  }
  return out;
}

export async function createMoment(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/add");

  const fields = readFields(formData);
  if (!fields.title) return { error: "Give your moment a title." };

  const files = collectFiles(formData);
  const fileError = validateFiles(files);
  if (fileError) return { error: fileError };

  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("id")
    .eq("auth_user_id", viewer.userId)
    .maybeSingle();

  const { data: moment, error: momentError } = await supabase
    .from("moments")
    .insert({
      title: fields.title,
      body: fields.body,
      category_id: fields.category_id,
      milestone_id: fields.milestone_id,
      author_person_id: person?.id ?? null,
      created_by: viewer.userId,
      event_date: fields.event_date,
      date_precision: fields.event_date ? fields.date_precision : "approx",
      location: fields.location,
    })
    .select("id")
    .single();
  if (momentError || !moment) {
    return { error: `Couldn’t save the moment: ${momentError?.message}` };
  }

  const taggedIds = await resolveTagged(supabase, fields.tagged, fields.taggedNew);
  if (taggedIds.length > 0) {
    await supabase
      .from("moment_people")
      .insert(taggedIds.map((person_id) => ({ moment_id: moment.id, person_id })));
  }

  if (files.length > 0) {
    const uploaded = await uploadFiles(moment.id, files, 0);
    await supabase.from("media").insert(
      uploaded.map((u) => ({
        owner_type: "moment",
        moment_id: moment.id,
        storage_path: u.storage_path,
        sort: u.sort,
        width: u.width,
        height: u.height,
        created_by: viewer.userId,
      }))
    );
  }

  revalidatePath("/");
  redirect(`/?added=${moment.id}`);
}

export async function updateMoment(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const momentId = String(formData.get("moment_id") ?? "");
  const fields = readFields(formData);
  if (!momentId) return { error: "Missing moment." };
  if (!fields.title) return { error: "Give your moment a title." };

  const files = collectFiles(formData);
  const fileError = validateFiles(files);
  if (fileError) return { error: fileError };

  const supabase = await createClient();

  // RLS restricts this update to the owner or an admin.
  const { data: updated, error: updateError } = await supabase
    .from("moments")
    .update({
      title: fields.title,
      body: fields.body,
      category_id: fields.category_id,
      milestone_id: fields.milestone_id,
      event_date: fields.event_date,
      date_precision: fields.event_date ? fields.date_precision : "approx",
      location: fields.location,
    })
    .eq("id", momentId)
    .select("id")
    .maybeSingle();
  if (updateError) return { error: `Couldn’t save: ${updateError.message}` };
  if (!updated) return { error: "You can only edit your own moments." };

  await supabase.from("moment_people").delete().eq("moment_id", momentId);
  const taggedIds = await resolveTagged(supabase, fields.tagged, fields.taggedNew);
  if (taggedIds.length > 0) {
    await supabase
      .from("moment_people")
      .insert(taggedIds.map((person_id) => ({ moment_id: momentId, person_id })));
  }

  if (files.length > 0) {
    const { count } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("moment_id", momentId);
    const uploaded = await uploadFiles(momentId, files, count ?? 0);
    await supabase.from("media").insert(
      uploaded.map((u) => ({
        owner_type: "moment",
        moment_id: momentId,
        storage_path: u.storage_path,
        sort: u.sort,
        width: u.width,
        height: u.height,
        created_by: viewer.userId,
      }))
    );
  }

  revalidatePath("/");
  redirect(`/?added=${momentId}`);
}

export async function deleteMoment(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const momentId = String(formData.get("moment_id") ?? "");
  if (!momentId) return;

  const supabase = await createClient();
  const { data: deleted } = await supabase
    .from("moments")
    .delete()
    .eq("id", momentId)
    .select("id")
    .maybeSingle();

  // Media rows cascade with the moment; clear the stored files too.
  if (deleted) {
    const service = serviceClient();
    const { data: objects } = await service.storage
      .from("media")
      .list(`moments/${momentId}`);
    if (objects && objects.length > 0) {
      await service.storage
        .from("media")
        .remove(objects.map((o) => `moments/${momentId}/${o.name}`));
    }
  }

  revalidatePath("/");
  redirect("/");
}

export async function deleteMedia(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const mediaId = String(formData.get("media_id") ?? "");
  if (!mediaId) return;

  const supabase = await createClient();
  const { data: deleted } = await supabase
    .from("media")
    .delete()
    .eq("id", mediaId)
    .select("storage_path")
    .maybeSingle();

  if (deleted?.storage_path?.startsWith("moments/")) {
    await serviceClient().storage.from("media").remove([deleted.storage_path]);
  }

  revalidatePath("/");
}
