import Timeline from "@/components/timeline/Timeline";
import { getViewer } from "@/lib/auth";
import { getTimelineData } from "@/lib/data";
import { getWalkthrough } from "@/lib/walkthrough";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, viewer, walkthrough] = await Promise.all([
    getTimelineData(),
    getViewer(),
    getWalkthrough(),
  ]);
  return (
    <Timeline
      data={data}
      walkthrough={walkthrough}
      viewer={
        viewer
          ? { userId: viewer.userId, name: viewer.name, isAdmin: viewer.isAdmin }
          : null
      }
    />
  );
}
