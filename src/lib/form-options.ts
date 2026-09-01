import "server-only";
import { serviceClient } from "./supabase/service";

// Select options shared by the moment forms.
export async function formOptions() {
  const service = serviceClient();
  const [categories, milestones, people] = await Promise.all([
    service.from("categories").select("id, label").order("sort"),
    service
      .from("milestones")
      .select("id, title, date_start")
      .order("date_start", { ascending: true, nullsFirst: false }),
    service.from("people").select("id, full_name").order("full_name"),
  ]);
  return {
    categories: (categories.data ?? []).map((c) => ({ id: c.id, label: c.label })),
    milestones: (milestones.data ?? []).map((m) => ({
      id: m.id,
      label: m.date_start ? `${m.title} (${m.date_start.slice(0, 7)})` : m.title,
    })),
    people: (people.data ?? []).map((p) => ({ id: p.id, label: p.full_name })),
  };
}
