export type DatePrecision = "day" | "month" | "year" | "approx";

export interface Person {
  id: string;
  full_name: string;
}

export interface MediaItem {
  id: string;
  url: string;
  caption: string | null;
  sort: number;
  width: number | null;
  height: number | null;
}

export interface Moment {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  milestone_id: string | null;
  author: string | null;
  tagged: string[];
  event_date: string | null;
  date_precision: DatePrecision;
  location: string | null;
  created_by: string | null;
  media: MediaItem[];
}

export interface Milestone {
  id: string;
  title: string;
  blurb: string | null;
  story: string | null;
  category: string | null;
  date_start: string | null;
  date_end: string | null;
  date_precision: DatePrecision;
  location: string | null;
  media: MediaItem[];
  moments: Moment[];
  upcoming: boolean;
}

export interface TimelineData {
  milestones: Milestone[];
  floatingMoments: Moment[];
  counts: { milestones: number; moments: number };
  yearRange: string;
}
