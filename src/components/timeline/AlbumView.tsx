import Link from "next/link";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  aspect,
  byline,
  clusterDateLabel,
  clusterEntries,
  excerpt,
  fmtDate,
  MediaEl,
  groupTimelineByYear,
  type ClusteredEntry,
} from "./shared";

function AlbumEntry({ ms, side }: { ms: Milestone; side: "left" | "right" }) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const heroMoment = ms.moments.find((m) => m.media[0]?.id === hero?.id);
  const photoExtras = ms.moments.filter(
    (m) => m.media[0] && m.media[0].id !== hero?.id
  );
  const textMoments = ms.moments.filter((m) => m.media.length === 0);
  const strip = [...photoExtras.slice(0, 4), ...textMoments.slice(0, 3)];
  const hidden = ms.moments.length - strip.length - (heroMoment ? 1 : 0);

  const heroImg = hero && (
    <MediaEl
      media={hero}
      className={s.albumPhoto}
      style={{ aspectRatio: aspect(hero, 3 / 4, 8 / 5) }}
      alt={ms.title}
    />
  );

  const figure = hero && (
    <figure
      className={`${s.albumFigure} ${side === "left" ? s.albumFigureLeft : s.albumFigureRight}`}
    >
      {heroMoment ? (
        <Link href={`/moment/${heroMoment.id}`}>{heroImg}</Link>
      ) : (
        <Link href={`/event/${ms.id}`}>{heroImg}</Link>
      )}
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
      <h2 className={s.albumEntryTitle}>
        <Link href={`/event/${ms.id}`} className={s.albumEntryLink}>
          {ms.title}
        </Link>
      </h2>
      {ms.blurb && <p className={s.albumBlurb}>{ms.blurb}</p>}
      <Link href={`/event/${ms.id}`} className={s.albumOpen}>
        {ms.moments.length === 0
          ? "Open this event →"
          : `Open this event · ${ms.moments.length} moment${ms.moments.length === 1 ? "" : "s"} →`}
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
      {strip.length > 0 && (
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
                <span className={s.albumStripQuote}>
                  {excerpt(m, 120) ?? m.title}
                </span>
                {excerpt(m) && (
                  <span className={s.albumStripCaption}>{m.title}</span>
                )}
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
      )}
    </>
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
          <MediaEl
            media={m.media[0]}
            className={s.albumFloatPhoto}
            style={{ aspectRatio: aspect(m.media[0], 3 / 4, 8 / 5) }}
          />
        ) : (
          quote && (
            <span className={s.albumFloatQuote}>{quote}</span>
          )
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
                <span className={s.albumStripQuote}>
                  {excerpt(m, 120) ?? m.title}
                </span>
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

export default function AlbumView({ data }: { data: TimelineData }) {
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

  return (
    <div>
      <div className={s.albumHero}>
        <div className={s.overline} style={{ marginBottom: 0 }}>
          Listen Labs, Remembered
        </div>
        <h1 className={s.albumTitle}>Lore</h1>
        <p className={s.albumLead}>
          Scroll down through time. The big events hold the small ones that made
          them worth remembering.
        </p>
      </div>

      <div className={s.albumBody}>
        <div className={s.albumSpine} />
        {years.map(([year, entries]) => (
          <section key={year}>
            <div className={s.albumYear}>
              <span className={`${s.albumYearNumeral} num`}>{year}</span>
            </div>
            {entries.map((e) =>
              e.kind === "milestone" ? (
                <AlbumEntry
                  key={e.ms.id}
                  ms={e.ms}
                  side={sideOf.get(e.ms.id) ?? "left"}
                />
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
