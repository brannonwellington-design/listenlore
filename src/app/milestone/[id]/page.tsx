import { permanentRedirect } from "next/navigation";

// Events live at /event/[id]; this older address forwards there so any
// links already shared keep working.
export default async function MilestoneRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/event/${id}`);
}
