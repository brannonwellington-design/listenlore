import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventDetail from "@/components/event/EventDetail";
import { getViewer } from "@/lib/auth";
import { getMilestone } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ms = await getMilestone(id);
  return { title: ms ? `${ms.title} · ListenLore` : "ListenLore" };
}

// One event (milestone) and everything that happened inside it.
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ms, viewer] = await Promise.all([getMilestone(id), getViewer()]);
  if (!ms) notFound();

  return (
    <EventDetail
      ms={ms}
      viewer={
        viewer
          ? { userId: viewer.userId, name: viewer.name, isAdmin: viewer.isAdmin }
          : null
      }
    />
  );
}
