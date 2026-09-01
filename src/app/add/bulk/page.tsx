import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { formOptions } from "@/lib/form-options";
import BulkComposer from "@/components/bulk/BulkComposer";

export const dynamic = "force-dynamic";

export default async function BulkAddPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/add/bulk");

  const options = await formOptions();

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <Link href="/add" style={{ fontSize: 14 }}>
        ← One moment at a time
      </Link>
      <h1 style={{ fontSize: 48, lineHeight: "52px", marginTop: 24 }}>
        Add Moments in Bulk
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: "24px",
          color: "var(--content-secondary)",
          margin: "16px 0 40px 0",
          maxWidth: 520,
        }}
      >
        Drop a pile of photos, decide whether they’re one memory or many, fill
        in the shared details once, and create everything in one go. Posting as{" "}
        {viewer.name}.
      </p>
      <BulkComposer
        categories={options.categories}
        milestones={options.milestones}
        people={options.people}
      />
    </div>
  );
}
