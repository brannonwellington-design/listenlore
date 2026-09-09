import Timeline from "@/components/timeline/Timeline";
import { getViewer } from "@/lib/auth";
import { getTimelineData } from "@/lib/data";
import { getLoreTour } from "@/lib/tour";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, viewer, tour] = await Promise.all([
    getTimelineData(),
    getViewer(),
    getLoreTour(),
  ]);
  return (
    <Timeline
      data={data}
      tour={tour}
      viewer={
        viewer
          ? { userId: viewer.userId, name: viewer.name, isAdmin: viewer.isAdmin }
          : null
      }
    />
  );
}
