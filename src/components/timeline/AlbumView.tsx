"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MediaItem, Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  byline,
  clusterDateLabel,
  clusterEntries,
  excerpt,
  fmtDate,
  MediaEl,
  groupTimelineByYear,
  type ClusteredEntry,
} from "./shared";

// Two motion registers over the same grid. Editorial: parallax photos,
// staggered reveals, the spine filling as you read. Cinematic: all of
// that, plus the year numeral pinned faintly behind its entries and the
// big beats breaking the grid as full-bleed spreads.
export type MotionMode = "editorial" | "cinematic";

function isMode(v: string | null): v is MotionMode {
  return v === "editorial" || v === "cinematic";
}

// Photo frames take fixed heights that are multiples of the leading, so
// every image's top and bottom land on the baseline. Orientation picks
// which height; the frame crops, the parallax moves the image inside it.
function frameKind(media: MediaItem | undefined): "portrait" | "square" | "landscape" {
  if (!media?.width || !media?.height) return "landscape";
  const r = media.width / media.height;
  if (r < 0.9) return "portrait";
  if (r < 1.15) return "square";
  return "landscape";
}

function ParallaxPhoto({
  media,
  alt,
  className,
}: {
  media: MediaItem;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`${s.frame} ${s[`frame_${frameKind(media)}`]} ${className ?? ""}`}>
      <MediaEl media={media} className={s.framePhoto} alt={alt} />
    </div>
  );
}

function momentCount(n: number): string {
  return `${n} moment${n === 1 ? "" : "s"}`;
}

function AlbumEntry({ ms, side }: { ms: Milestone; side: "left" | "right" }) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const heroMoment = ms.moments.find((m) => m.media[0]?.id === hero?.id);
  const photoExtras = ms.moments.filter(
    (m) => m.media[0] && m.media[0].id !== hero?.id
  );
  const textMoments = ms.moments.filter((m) => m.media.length === 0);
  const strip = [...photoExtras.slice(0, 4), ...textMoments.slice(0, 3)];
  const hidden = ms.moments.length - strip.length - (heroMoment ? 1 : 0);

  const figure = hero && (
    <figure
      className={`${s.albumFigure} ${side === "left" ? s.albumFigureLeft : s.albumFigureRight}`}
    >
      <Link href={heroMoment ? `/moment/${heroMoment.id}` : `/event/${ms.id}`}>
        <ParallaxPhoto media={hero} alt={ms.title} />
      </Link>
      {heroMoment && (
        <figcaption className={s.albumCaption}>
          <Link href={`/moment/${heroMoment.id}`} className={s.momentTitleLink}>
            {heroMoment.title}
          </Link>
          {byline(heroMoment) ? ` · ${byline(heroMoment)}` : ""}
        </figcaption>
      )}
    </figure>
  );

  const text = (
    <div
      className={`${s.albumText} ${side === "left" ? s.albumTextRight : s.albumTextLeft}`}
    >
      <div className={`${s.albumMetaLine} num`}>
        {fmtDate(ms)}
        {ms.location ? ` · ${ms.location}` : ""}
        {ms.category ? ` · ${ms.category}` : ""}
      </div>
      <h2 className={s.albumEntryTitle} data-optical={side === "right" ? "" : undefined}>
        <Link href={`/event/${ms.id}`} className={s.albumEntryLink}>
          {ms.title}
        </Link>
      </h2>
      {ms.blurb && <p className={s.albumBlurb}>{ms.blurb}</p>}
      <Link href={`/event/${ms.id}`} className={s.albumOpen}>
        {ms.moments.length === 0
          ? "Open this event →"
          : `Open this event · ${momentCount(ms.moments.length)} →`}
      </Link>
    </div>
  );

  return (
    <>
      <div className={`grid12 ${s.albumEntry}`}>
        <div className={s.albumDot} />
        {side === "left" ? (
          <>
            {figure}
            {text}
          </>
        ) : (
          <>
            {text}
            {figure}
          </>
        )}
      </div>
      <Strip ms={ms} strip={strip} hidden={hidden} />
    </>
  );
}

// The big beats in cinematic mode: the photo takes the whole width and the
// grid comes back for the words, set low on the picture.
function AlbumSpread({ ms }: { ms: Milestone }) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const heroMoment = ms.moments.find((m) => m.media[0]?.id === hero?.id);
  const rest = ms.moments.filter((m) => m.media[0]?.id !== hero?.id);
  const strip = [
    ...rest.filter((m) => m.media[0]).slice(0, 4),
    ...rest.filter((m) => m.media.length === 0).slice(0, 3),
  ];
  const hidden = ms.moments.length - strip.length - (heroMoment ? 1 : 0);
  if (!hero) return <AlbumEntry ms={ms} side="left" />;

  return (
    <div className={s.albumSpread}>
      <div className={s.spread}>
        <div className={s.spreadFrame}>
          <MediaEl media={hero} className={s.spreadPhoto} alt={ms.title} />
        </div>
        <div className={s.spreadScrim} />
        <div className={`grid12 ${s.spreadText}`}>
          <div className={s.spreadBody}>
            <div className={`${s.spreadMeta} num`}>
              {fmtDate(ms)}
              {ms.location ? ` · ${ms.location}` : ""}
              {ms.category ? ` · ${ms.category}` : ""}
              {ms.moments.length > 0 ? ` · ${momentCount(ms.moments.length)}` : ""}
            </div>
            <h2 className={s.spreadTitle} data-optical="">
              <Link href={`/event/${ms.id}`} className={s.spreadLink}>
                {ms.title}
              </Link>
            </h2>
            {ms.blurb && <p className={s.spreadBlurb}>{ms.blurb}</p>}
            <Link href={`/event/${ms.id}`} className={s.spreadOpen}>
              Open this event →
            </Link>
          </div>
          {heroMoment && (
            <div className={s.spreadCaption}>
              <Link href={`/moment/${heroMoment.id}`} className={s.spreadLink}>
                {heroMoment.title}
              </Link>
              {byline(heroMoment) ? ` · ${byline(heroMoment)}` : ""}
            </div>
          )}
        </div>
      </div>
      <Strip ms={ms} strip={strip} hidden={hidden} />
    </div>
  );
}

function Strip({
  ms,
  strip,
  hidden,
}: {
  ms: Milestone;
  strip: Moment[];
  hidden: number;
}) {
  if (strip.length === 0) return null;
  return (
    <div className={s.albumStrip}>
      {strip.map((m) =>
        m.media[0] ? (
          <Link
            key={m.id}
            href={`/moment/${m.id}`}
            className={s.albumStripItem}
            title={m.title}
            data-moment-id={m.id}
          >
            <MediaEl media={m.media[0]} className={s.albumStripThumb} alt={m.title} />
            <span className={s.albumStripCaption}>{m.title}</span>
          </Link>
        ) : (
          <Link
            key={m.id}
            href={`/moment/${m.id}`}
            className={s.albumStripText}
            title={m.title}
            data-moment-id={m.id}
          >
            <span className={s.albumStripQuote}>{excerpt(m, 120) ?? m.title}</span>
            {excerpt(m) && <span className={s.albumStripCaption}>{m.title}</span>}
          </Link>
        )
      )}
      {hidden > 0 && (
        <Link href={`/event/${ms.id}`} className={s.albumStripMore}>
          <span className={s.albumStripMoreCount}>+{hidden}</span>
          <span className={s.albumStripCaption}>more in this event</span>
        </Link>
      )}
    </div>
  );
}

// A free-floating moment sits on the spine like a snapshot tucked between
// album pages: photo or quote, then title and full byline.
function AlbumMoment({ m }: { m: Moment }) {
  const quote = excerpt(m, 160);
  return (
    <div className={s.albumFloatEntry} data-moment-id={m.id}>
      <div className={s.albumDotSmall} />
      <Link href={`/moment/${m.id}`} className={s.albumFloatCard} title={m.title}>
        {m.media[0] ? (
          <ParallaxPhoto media={m.media[0]} alt="" className={s.frameSmall} />
        ) : (
          quote && <span className={s.albumFloatQuote}>{quote}</span>
        )}
        <span className={s.albumCaption}>
          {m.title}
          {byline(m) ? ` · ${byline(m)}` : ""}
        </span>
      </Link>
    </div>
  );
}

// A run of them becomes a loose handful of snapshots scattered across the
// spine — the way photos pile up between an album's big pages.
function AlbumMomentCluster({ moments }: { moments: Moment[] }) {
  if (moments.length === 1) return <AlbumMoment m={moments[0]} />;
  return (
    <div className={s.albumFloatEntry}>
      <div className={s.albumDotSmall} />
      <div className={s.albumClusterWrap}>
        <div className={`${s.albumClusterKicker} num`}>
          {clusterDateLabel(moments)} · {moments.length} moments
        </div>
        <div className={s.albumClusterStrip}>
          {moments.map((m) =>
            m.media[0] ? (
              <Link
                key={m.id}
                href={`/moment/${m.id}`}
                className={s.albumStripItem}
                title={m.title}
                data-moment-id={m.id}
              >
                <MediaEl
                  media={m.media[0]}
                  className={s.albumStripThumb}
                  alt={m.title}
                />
                <span className={s.albumStripCaption}>{m.title}</span>
              </Link>
            ) : (
              <Link
                key={m.id}
                href={`/moment/${m.id}`}
                className={s.albumStripText}
                title={m.title}
                data-moment-id={m.id}
              >
                <span className={s.albumStripQuote}>{excerpt(m, 120) ?? m.title}</span>
                <span className={s.albumStripCaption}>
                  {m.title}
                  {m.author ? ` · ${m.author}` : ""}
                </span>
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// A big beat is an event with enough inside it to carry a spread.
function isBigBeat(ms: Milestone): boolean {
  const hasPhoto = ms.media.length > 0 || ms.moments.some((m) => m.media.length > 0);
  return hasPhoto && (ms.moments.length >= 3 || ms.media.length > 0);
}

export default function AlbumView({ data }: { data: TimelineData }) {
  const [mode, setMode] = useState<MotionMode>("editorial");

  // ?motion= wins, then the remembered choice. Deferred a frame so the
  // first client render matches the server HTML.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("motion");
    requestAnimationFrame(() => {
      if (isMode(fromUrl)) {
        setMode(fromUrl);
        return;
      }
      try {
        const saved = window.localStorage.getItem("lore-motion");
        if (isMode(saved)) setMode(saved);
      } catch {}
    });
  }, []);

  const pickMode = (m: MotionMode) => {
    setMode(m);
    try {
      window.localStorage.setItem("lore-motion", m);
    } catch {}
    const params = new URLSearchParams(window.location.search);
    params.set("motion", m);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const years: [string, ClusteredEntry[]][] = groupTimelineByYear(data)
    .map(
      ([year, entries]) =>
        [
          year,
          clusterEntries(
            entries.filter((e) => e.kind !== "milestone" || !e.ms.upcoming)
          ),
        ] as [string, ClusteredEntry[]]
    )
    .filter(([, entries]) => entries.length > 0);
  const upcoming = data.milestones.filter((m) => m.upcoming);
  const milestonesInOrder = years
    .flatMap(([, list]) => list)
    .filter((e) => e.kind === "milestone");
  const sideOf = new Map<string, "left" | "right">(
    milestonesInOrder.map((e, i) => [
      (e as { ms: Milestone }).ms.id,
      i % 2 === 0 ? "left" : "right",
    ])
  );
  const yearSpan =
    years.length > 0 ? Number(years[years.length - 1][0]) - Number(years[0][0]) + 1 : 0;

  return (
    <div className={s.album} data-motion={mode}>
      <div className={`grid12 ${s.albumHero}`}>
        <div className={s.albumKicker}>Listen Labs, Remembered</div>
        <div className={s.motionPick} aria-label="Motion">
          <span className={s.motionPickLabel}>Motion</span>
          {(["editorial", "cinematic"] as MotionMode[]).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              className={`${s.motionBtn} ${mode === m ? s.motionBtnActive : ""}`}
              onClick={() => pickMode(m)}
            >
              {m === "editorial" ? "Editorial" : "Cinematic"}
            </button>
          ))}
        </div>
        <h1 className={s.albumTitle} data-optical="">
          Lore
        </h1>
        <p className={s.albumLead}>
          Scroll down through time. The big events hold the small ones that made
          them worth remembering.
        </p>
        <div className={s.albumStats}>
          {[
            [yearSpan, "Years"],
            [data.counts.milestones, "Events"],
            [data.counts.moments, "Moments"],
            [data.counts.people, "People"],
          ].map(([value, label]) => (
            <div key={label} className={s.albumStat}>
              <span className={`${s.albumStatValue} num`}>{value}</span>
              <span className={s.albumStatLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={s.albumBody}>
        <div className={s.albumSpine} />
        {years.map(([year, entries]) => (
          <section key={year} className={s.albumYearSection}>
            <div className={s.albumSpineFill} />
            <div className={s.albumYear}>
              <span className={`${s.albumYearNumeral} num`}>{year}</span>
            </div>
            <div className={s.albumOpener} aria-hidden="true">
              <span className={`${s.albumOpenerNumeral} num`} data-optical="">
                {year}
              </span>
            </div>
            {entries.map((e) =>
              e.kind === "milestone" ? (
                mode === "cinematic" && isBigBeat(e.ms) ? (
                  <AlbumSpread key={e.ms.id} ms={e.ms} />
                ) : (
                  <AlbumEntry
                    key={e.ms.id}
                    ms={e.ms}
                    side={sideOf.get(e.ms.id) ?? "left"}
                  />
                )
              ) : (
                <AlbumMomentCluster key={e.moments[0].id} moments={e.moments} />
              )
            )}
          </section>
        ))}
      </div>

      {upcoming.map((ms) => (
        <div key={ms.id} className={s.albumInvite}>
          <div className={`${s.albumInviteKicker} num`}>
            {fmtDate(ms)} · Upcoming
          </div>
          <h2 className={s.albumInviteTitle}>
            <Link href={`/event/${ms.id}`} className={s.albumInviteLink}>
              {ms.title}
            </Link>
          </h2>
          {ms.blurb && <p className={s.albumInviteLead}>{ms.blurb}</p>}
        </div>
      ))}
    </div>
  );
}
