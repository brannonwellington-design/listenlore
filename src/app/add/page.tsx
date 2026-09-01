import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { formOptions } from "@/lib/form-options";
import MomentForm from "@/components/MomentForm";
import { createMoment } from "./actions";

export const dynamic = "force-dynamic";

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
          margin: "16px 0 8px 0",
          maxWidth: 480,
        }}
      >
        Posting as {viewer.name}. It goes live on the timeline right away, and
        you can edit or remove it whenever.
      </p>
      <p style={{ fontSize: 14, lineHeight: "20px", margin: "0 0 40px 0" }}>
        Adding a lot at once?{" "}
        <Link href="/add/bulk" style={{ color: "var(--content-brand)" }}>
          Switch to bulk mode →
        </Link>
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
