import Timeline from "@/components/timeline/Timeline";
import { getViewer } from "@/lib/auth";
import { getTimelineData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, viewer] = await Promise.all([getTimelineData(), getViewer()]);
  return (
    <Timeline
      data={data}
      viewer={
        viewer
          ? { userId: viewer.userId, name: viewer.name, isAdmin: viewer.isAdmin }
          : null
      }
    />
  );
}
