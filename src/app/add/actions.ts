"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { getViewer, type Viewer } from "@/lib/auth";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_BULK_MOMENTS,
  MAX_BULK_PHOTOS,
  MAX_FILE_BYTES,
  MAX_PHOTOS_PER_MOMENT,
  type UploadTicket,
  type UploadedPhoto,
} from "@/lib/upload";

// ---------------------------------------------------------------------------
// Direct-to-storage uploads: the browser asks for signed tickets, uploads
// straight to Supabase storage, and actions only ever receive small metadata.
// ---------------------------------------------------------------------------

export async function requestUploadTickets(
  files: { type: string; size: number }[]
): Promise<{ tickets: UploadTicket[] } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Sign in to upload photos." };
  if (files.length === 0 || files.length > MAX_BULK_PHOTOS) {
    return { error: `Up to ${MAX_BULK_PHOTOS} photos at a time.` };
  }
  for (const f of files) {
    if (!ACCEPTED_IMAGE_TYPES[f.type]) {
      return {
        error:
          "Only JPEG, PNG, WebP, or GIF photos (iPhone HEIC photos need exporting as JPEG).",
      };
    }
    if (f.size > MAX_FILE_BYTES) return { error: "Each photo must be under 10 MB." };
  }

  const service = serviceClient();
  const tickets: UploadTicket[] = [];
  for (const f of files) {
    const path = `uploads/${viewer.userId}/${crypto.randomUUID()}.${ACCEPTED_IMAGE_TYPES[f.type]}`;
    const { data, error } = await service.storage
      .from("media")
      .createSignedUploadUrl(path);
    if (error || !data) return { error: `Couldn’t prepare the upload: ${error?.message}` };
    tickets.push({ path: data.path, token: data.token });
  }
  return { tickets };
}

function parseUploaded(raw: string[], viewer: Viewer): UploadedPhoto[] | null {
  const out: UploadedPhoto[] = [];
  for (const item of raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(item);
    } catch {
      return null;
    }
    const p = parsed as UploadedPhoto;
    if (
      typeof p.path !== "string" ||
      !p.path.startsWith(`uploads/${viewer.userId}/`)
    ) {
      return null;
    }
    out.push({
      path: p.path,
      width: typeof p.width === "number" ? p.width : null,
      height: typeof p.height === "number" ? p.height : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shared field handling
// ---------------------------------------------------------------------------

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

interface MomentInput {
  title: string;
  body: string | null;
  category_id: string | null;
  milestone_id: string | null;
  event_date: string | null;
  date_precision: string;
  location: string | null;
  taggedIds: string[];
  photos: UploadedPhoto[];
}

async function insertMoment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewer: Viewer,
  authorPersonId: string | null,
  input: MomentInput
): Promise<{ id: string } | { error: string }> {
  const { data: moment, error } = await supabase
    .from("moments")
    .insert({
      title: input.title,
      body: input.body,
      category_id: input.category_id,
      milestone_id: input.milestone_id,
      author_person_id: authorPersonId,
      created_by: viewer.userId,
      event_date: input.event_date,
      date_precision: input.event_date ? input.date_precision : "approx",
      location: input.location,
    })
    .select("id")
    .single();
  if (error || !moment) return { error: error?.message ?? "insert failed" };

  if (input.taggedIds.length > 0) {
    await supabase
      .from("moment_people")
      .insert(input.taggedIds.map((person_id) => ({ moment_id: moment.id, person_id })));
  }
  if (input.photos.length > 0) {
    await supabase.from("media").insert(
      input.photos.map((p, i) => ({
        owner_type: "moment",
        moment_id: moment.id,
        storage_path: p.path,
        sort: i,
        width: p.width,
        height: p.height,
        created_by: viewer.userId,
      }))
    );
  }
  return { id: moment.id };
}

async function authorPersonId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewer: Viewer
): Promise<string | null> {
  const { data } = await supabase
    .from("people")
    .select("id")
    .eq("auth_user_id", viewer.userId)
    .maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Single moment
// ---------------------------------------------------------------------------

export async function createMoment(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/add");

  const fields = readFields(formData);
  if (!fields.title) return { error: "Give your moment a title." };

  const photos = parseUploaded(formData.getAll("uploaded").map(String), viewer);
  if (photos === null) return { error: "Photo upload data looked wrong — re-add the photos." };
  if (photos.length > MAX_PHOTOS_PER_MOMENT) {
    return { error: `Up to ${MAX_PHOTOS_PER_MOMENT} photos per moment.` };
  }

  const supabase = await createClient();
  const person = await authorPersonId(supabase, viewer);
  const taggedIds = await resolveTagged(supabase, fields.tagged, fields.taggedNew);

  const result = await insertMoment(supabase, viewer, person, {
    ...fields,
    taggedIds,
    photos,
  });
  if ("error" in result) return { error: `Couldn’t save the moment: ${result.error}` };

  revalidatePath("/");
  redirect(`/?added=${result.id}`);
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

  const photos = parseUploaded(formData.getAll("uploaded").map(String), viewer);
  if (photos === null) return { error: "Photo upload data looked wrong — re-add the photos." };

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

  if (photos.length > 0) {
    const { count } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("moment_id", momentId);
    await supabase.from("media").insert(
      photos.map((p, i) => ({
        owner_type: "moment",
        moment_id: momentId,
        storage_path: p.path,
        sort: (count ?? 0) + i,
        width: p.width,
        height: p.height,
        created_by: viewer.userId,
      }))
    );
  }

  revalidatePath("/");
  redirect(`/?added=${momentId}`);
}

// ---------------------------------------------------------------------------
// Bulk creation
// ---------------------------------------------------------------------------

interface BulkPayload {
  tagged: string[];
  tagged_new: string[];
  moments: {
    title: string;
    body?: string;
    category_id?: string;
    milestone_id?: string;
    event_date?: string;
    date_precision?: string;
    location?: string;
    photos: UploadedPhoto[];
  }[];
}

export async function createMoments(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/add/bulk");

  let payload: BulkPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "The submission looked malformed — try again." };
  }

  const moments = payload.moments ?? [];
  if (moments.length === 0) return { error: "Nothing to create yet." };
  if (moments.length > MAX_BULK_MOMENTS) {
    return { error: `Up to ${MAX_BULK_MOMENTS} moments per batch.` };
  }
  const totalPhotos = moments.reduce((n, m) => n + (m.photos?.length ?? 0), 0);
  if (totalPhotos > MAX_BULK_PHOTOS) {
    return { error: `Up to ${MAX_BULK_PHOTOS} photos per batch.` };
  }

  for (const m of moments) {
    if (!m.title || !String(m.title).trim()) {
      return { error: "Every moment needs a title before creating." };
    }
    if ((m.photos?.length ?? 0) > MAX_PHOTOS_PER_MOMENT) {
      return { error: `Up to ${MAX_PHOTOS_PER_MOMENT} photos per moment.` };
    }
    const photos = parseUploaded(
      (m.photos ?? []).map((p) => JSON.stringify(p)),
      viewer
    );
    if (photos === null) return { error: "Photo upload data looked wrong — try again." };
  }

  const supabase = await createClient();
  const person = await authorPersonId(supabase, viewer);
  const taggedIds = await resolveTagged(
    supabase,
    (payload.tagged ?? []).map(String),
    (payload.tagged_new ?? []).map(String)
  );

  const created: string[] = [];
  for (const m of moments) {
    const precision = String(m.date_precision ?? "approx");
    const result = await insertMoment(supabase, viewer, person, {
      title: String(m.title).trim(),
      body: m.body?.trim() || null,
      category_id: m.category_id || null,
      milestone_id: m.milestone_id || null,
      event_date: m.event_date || null,
      date_precision: ["day", "month", "year", "approx"].includes(precision)
        ? precision
        : "approx",
      location: m.location?.trim() || null,
      taggedIds,
      photos: m.photos ?? [],
    });
    if ("error" in result) {
      return {
        error: `Created ${created.length} of ${moments.length}, then hit: ${result.error}. The created ones are live; fix and resubmit the rest.`,
      };
    }
    created.push(result.id);
  }

  revalidatePath("/");
  redirect(`/?added=${created.join(",")}`);
}

// ---------------------------------------------------------------------------
// Adding photos to an existing moment (owner or admin only)
// ---------------------------------------------------------------------------

export async function addPhotosToMoment(
  _prev: { error: string } | { ok: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const momentId = String(formData.get("moment_id") ?? "");
  const photos = parseUploaded(formData.getAll("uploaded").map(String), viewer);
  if (!momentId || photos === null || photos.length === 0) {
    return { error: "No photos to add." };
  }

  const supabase = await createClient();
  const { data: moment } = await supabase
    .from("moments")
    .select("id, created_by")
    .eq("id", momentId)
    .maybeSingle();
  if (!moment || (!viewer.isAdmin && moment.created_by !== viewer.userId)) {
    return { error: "You can only add photos to your own moments." };
  }

  const { count } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("moment_id", momentId);
  if ((count ?? 0) + photos.length > MAX_PHOTOS_PER_MOMENT) {
    return { error: `Up to ${MAX_PHOTOS_PER_MOMENT} photos per moment.` };
  }

  await supabase.from("media").insert(
    photos.map((p, i) => ({
      owner_type: "moment",
      moment_id: momentId,
      storage_path: p.path,
      sort: (count ?? 0) + i,
      width: p.width,
      height: p.height,
      created_by: viewer.userId,
    }))
  );

  revalidatePath("/");
  revalidatePath(`/moment/${momentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

export async function deleteMoment(formData: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const momentId = String(formData.get("moment_id") ?? "");
  if (!momentId) return;

  const supabase = await createClient();
  const { data: mediaRows } = await supabase
    .from("media")
    .select("storage_path")
    .eq("moment_id", momentId);

  const { data: deleted } = await supabase
    .from("moments")
    .delete()
    .eq("id", momentId)
    .select("id")
    .maybeSingle();

  // Media rows cascade with the moment; clear the stored files too.
  if (deleted && mediaRows && mediaRows.length > 0) {
    const paths = mediaRows
      .map((m) => m.storage_path)
      .filter((p) => p.startsWith("moments/") || p.startsWith("uploads/"));
    if (paths.length > 0) {
      await serviceClient().storage.from("media").remove(paths);
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

  if (
    deleted?.storage_path &&
    (deleted.storage_path.startsWith("moments/") ||
      deleted.storage_path.startsWith("uploads/"))
  ) {
    await serviceClient().storage.from("media").remove([deleted.storage_path]);
  }

  revalidatePath("/");
}
