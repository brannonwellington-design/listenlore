import Link from "next/link";
import type { Milestone, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import { aspect, fmtDate, groupByYear } from "./shared";

function AlbumEntry({ ms, side }: { ms: Milestone; side: "left" | "right" }) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const heroMoment = ms.moments.find((m) => m.media[0]?.id === hero?.id);
  const photoExtras = ms.moments.filter(
    (m) => m.media[0] && m.media[0].id !== hero?.id
  );
  const textMoments = ms.moments.filter((m) => m.media.length === 0);
  const strip = [...photoExtras.slice(0, 4), ...textMoments.slice(0, 3)];

  const figure = hero && (
    <figure
      className={`${s.albumFigure} ${side === "left" ? s.albumFigureLeft : s.albumFigureRight}`}
    >
      <img
        className={s.albumPhoto}
        style={{ aspectRatio: aspect(hero, 3 / 4, 8 / 5) }}
        src={hero.url}
        alt={ms.title}
        loading="lazy"
      />
      {heroMoment && (
        <figcaption className={s.albumCaption}>
          {heroMoment.title}
          {heroMoment.author ? ` · ${heroMoment.author}` : ""}
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
        {ms.date_precision === "approx" && ms.date_start ? " ≈" : ""}
        {ms.location ? ` · ${ms.location}` : ""}
      </div>
      <h2 className={s.albumEntryTitle}>{ms.title}</h2>
      {ms.blurb && <p className={s.albumBlurb}>{ms.blurb}</p>}
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
              <Link key={m.id} href={`/moment/${m.id}`} title={m.title}>
                <img
                  className={s.albumStripThumb}
                  src={m.media[0].url}
                  alt={m.title}
                  loading="lazy"
                />
              </Link>
            ) : (
              <Link
                key={m.id}
                href={`/moment/${m.id}`}
                className={s.albumStripText}
              >
                {m.title}
              </Link>
            )
          )}
        </div>
      )}
    </>
  );
}

export default function AlbumView({ data }: { data: TimelineData }) {
  const years = groupByYear(data.milestones.filter((m) => !m.upcoming));
  const upcoming = data.milestones.filter((m) => m.upcoming);
  const sideOf = new Map<string, "left" | "right">(
    years
      .flatMap(([, list]) => list)
      .map((ms, i) => [ms.id, i % 2 === 0 ? "left" : "right"])
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
        {years.map(([year, milestones]) => (
          <section key={year}>
            <div className={s.albumYear}>
              <span className={`${s.albumYearNumeral} num`}>{year}</span>
            </div>
            {milestones.map((ms) => (
              <AlbumEntry key={ms.id} ms={ms} side={sideOf.get(ms.id) ?? "left"} />
            ))}
          </section>
        ))}
      </div>

      {upcoming.map((ms) => (
        <div key={ms.id} className={s.albumInvite}>
          <div className={`${s.albumInviteKicker} num`}>
            {fmtDate(ms)} · Upcoming
          </div>
          <h2 className={s.albumInviteTitle}>{ms.title}</h2>
          {ms.blurb && <p className={s.albumInviteLead}>{ms.blurb}</p>}
        </div>
      ))}
    </div>
  );
}
