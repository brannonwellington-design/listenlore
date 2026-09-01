import Timeline from "@/components/Timeline";
import { getTimelineData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getTimelineData();
  return <Timeline data={data} />;
}
