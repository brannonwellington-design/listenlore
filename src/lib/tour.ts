import "server-only";
import { serviceClient } from "./supabase/service";

// The two-minute guided tour: Alfred's narration plus a slideshow cut to
// its beats. Times are seconds into the narration audio; each beat's
// images cycle evenly across its window. Curated from the seed archive.
const AUDIO_PATH = "seed/lore-tour-narration.mp3";

const BEATS: { start: number; paths: string[] }[] = [
  // Welcome
  {
    start: 0,
    paths: [
      "seed/team_teamphotos_08-07-2026-6.jpg",
      "seed/team_yearinreview_12-31-2025-1.jpg",
    ],
  },
  // Cold open: Harvard, Be Fake
  {
    start: 14.9,
    paths: [
      "seed/team_originstory_06-24-2025-1.jpg",
      "seed/team_originstory_01-02-2026-2.jpg",
      "seed/team_dynamicduo_09-03-2023-4.jpg",
    ],
  },
  // San Francisco: hacker house, employee one, the toilet
  {
    start: 34.7,
    paths: [
      "seed/team_oldoffice_05-26-2026-2.jpg",
      "seed/team_oldoffice_05-26-2026-1.jpg",
    ],
  },
  // The break: pitch wins, Sequoia, the billboard
  {
    start: 50.8,
    paths: [
      "seed/events_sequoiaaiascent2025_05-08-2025-1.jpg",
      "seed/brand_billboardno1_09-02-2025-4.jpg",
      "seed/brand_billboardno1_09-03-2025-3.png",
      "seed/brand_billboardno1_09-19-2025-2.jpg",
    ],
  },
  // Series B day
  {
    start: 71.9,
    paths: [
      "seed/brand_seriesbvideo_12-13-2025-1.jpg",
      "seed/brand_seriesbvideo_12-13-2025-2.jpg",
      "seed/events_seriesbparty_03-20-2026.jpg",
    ],
  },
  // Summer of New York
  {
    start: 89.3,
    paths: [
      "seed/team_nycoffice_08-20-2026-1.jpg",
      "seed/events_quirksnyc2025_07-28-2025-3.jpg",
      "seed/brand_nycooh_08-03-2026-1.jpg",
      "seed/brand_nycooh_08-19-2026-2.jpg",
    ],
  },
  // 100 people, four offices, Hawaii (and Maddie's reminder)
  {
    start: 119.0,
    paths: [
      "seed/team_100listeners_08-24-2026-1.jpg",
      "seed/team_londonoffice_06-23-2026-1.jpg",
      "seed/events_hawaiioffsite_07-14-2026-1.jpg",
    ],
  },
  // Add yours
  {
    start: 132.7,
    paths: [
      "seed/team_fikas_05-26-2026-1.jpg",
      "seed/team_firstmerch_05-26-2026.jpg",
      "seed/team_teamphotos_04-21-2026-4.jpg",
    ],
  },
];

export const TOUR_DURATION = 148.8;

export interface TourBeat {
  start: number;
  images: string[];
}

export interface TourData {
  audioUrl: string;
  duration: number;
  beats: TourBeat[];
}

const TTL = 60 * 60 * 24; // a day; the page re-renders fresh URLs anyway

export async function getLoreTour(): Promise<TourData | null> {
  const service = serviceClient();
  const paths = [AUDIO_PATH, ...BEATS.flatMap((b) => b.paths)];
  const { data, error } = await service.storage
    .from("media")
    .createSignedUrls(paths, TTL);
  if (error || !data) return null;

  const byPath = new Map<string, string>();
  for (const s of data) {
    if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  }
  const audioUrl = byPath.get(AUDIO_PATH);
  if (!audioUrl) return null;

  return {
    audioUrl,
    duration: TOUR_DURATION,
    beats: BEATS.map((b) => ({
      start: b.start,
      images: b.paths
        .map((p) => byPath.get(p))
        .filter((u): u is string => !!u),
    })).filter((b) => b.images.length > 0),
  };
}
