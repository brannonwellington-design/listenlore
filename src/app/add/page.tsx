import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import MomentForm from "@/components/MomentForm";
import { createMoment } from "./actions";

export const dynamic = "force-dynamic";

async function formOptions() {
  const service = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
  const [categories, milestones, people] = await Promise.all([
    service.from("categories").select("id, label").order("sort"),
    service.from("milestones").select("id, title, date_start").order("date_start", { ascending: true, nullsFirst: false }),
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

export default async function AddMomentPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/add");

  const options = await formOptions();

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 96 }}>
      <Link href="/" style={{ fontSize: 14 }}>
        ← Back to the timeline
      </Link>
      <h1 style={{ fontSize: 48, lineHeight: "52px", marginTop: 24 }}>
        Add a Moment
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: "24px",
          color: "var(--content-secondary)",
          margin: "16px 0 40px 0",
          maxWidth: 480,
        }}
      >
        Posting as {viewer.name}. It goes live on the timeline right away, and
        you can edit or remove it whenever.
      </p>
      <MomentForm
        action={createMoment}
        categories={options.categories}
        milestones={options.milestones}
        people={options.people}
        submitLabel="Add to the timeline"
      />
    </div>
  );
}
