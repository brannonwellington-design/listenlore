import Link from "next/link";
import type { Milestone, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  aspect,
  byline,
  EditLink,
  excerpt,
  fmtDate,
  groupByYear,
  MomentRow,
  type ViewerInfo,
} from "./shared";

function RegisterMilestone({
  ms,
  viewer,
}: {
  ms: Milestone;
  viewer: ViewerInfo | null;
}) {
  const expanded = ms.moments.length > 1;
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];

  if (ms.upcoming) {
    return (
      <div className={`grid12 ${s.upcomingPanel}`}>
        <div className={s.bandMeta}>
          <div className={`${s.metaDate} ${s.upcomingMeta} num`}>{fmtDate(ms)}</div>
          <div className={`${s.metaSub} ${s.upcomingMeta}`}>
            Upcoming{ms.location ? ` · ${ms.location}` : ""}
          </div>
        </div>
        <div className={`${s.bandBody} ${s.bandBodyWide}`}>
          <h2 className={s.bandTitle}>{ms.title}</h2>
          {ms.blurb && <p className={s.upcomingBlurb}>{ms.blurb}</p>}
          {ms.moments.length > 0 && (
            <div className={s.momentRail}>
              {ms.moments.map((m) => (
                <MomentRow key={m.id} m={m} viewer={viewer} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid12 ${s.band}`}>
      <div className={s.bandMeta}>
        <div className={`${s.metaDate} num`}>{fmtDate(ms)}</div>
        {ms.date_precision === "approx" && ms.date_start && (
          <div className={s.metaApprox}>Approximate</div>
        )}
        <div className={s.metaSub}>
          {[ms.category, ms.location].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div
        className={`${s.bandBody} ${expanded || !hero ? s.bandBodyWide : ""}`}
      >
        <h2 className={s.bandTitle}>{ms.title}</h2>
        {ms.blurb && <p className={s.bandBlurb}>{ms.blurb}</p>}
        {expanded ? (
          <div className={s.momentGrid}>
            {ms.moments.map((m) => (
              <div key={m.id} className={s.momentCard} data-moment-id={m.id}>
                {m.media[0] ? (
                  <Link href={`/moment/${m.id}`}>
                    <img
                      className={s.momentCardPhoto}
                      style={{ aspectRatio: aspect(m.media[0]) }}
                      src={m.media[0].url}
                      alt=""
                      loading="lazy"
                    />
                  </Link>
                ) : (
                  excerpt(m, 220) && (
                    <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
                      <div className={s.quoteBlock}>
                        <div className={s.quoteClamp}>{excerpt(m, 220)}</div>
                      </div>
                    </Link>
                  )
                )}
                <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
                  <span className={s.momentCardTitle}>{m.title}</span>
                </Link>
                <div className={s.momentByline}>
                  {byline(m)} <EditLink viewer={viewer} m={m} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          ms.moments.length > 0 && (
            <div className={s.momentRail}>
              {ms.moments.map((m) => (
                <MomentRow key={m.id} m={m} viewer={viewer} />
              ))}
            </div>
          )
        )}
      </div>
      {!expanded && hero && (
        <figure className={s.bandFigure}>
          <img
            className={s.bandPhoto}
            style={{ aspectRatio: aspect(hero, 3 / 4, 3 / 2) }}
            src={hero.url}
            alt={ms.title}
            loading="lazy"
          />
        </figure>
      )}
    </div>
  );
}

export default function RegisterView({
  data,
  viewer,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
}) {
  const years = groupByYear(data.milestones);
  const undated = data.milestones.filter((m) => !m.date_start);

  return (
    <div className={s.footerSpace}>
      <div className={`grid12 ${s.hero}`}>
        <div style={{ gridColumn: "1 / 9" }}>
          <div className={s.overline}>Company History, Told by the People in It</div>
          <h1 className={s.heroTitle}>The Story So Far</h1>
          <p className={s.heroLead}>
            Every milestone that got us here, and the moments people remember
            around them. Milestones are curated; moments belong to everyone.
          </p>
        </div>
        <div className={`${s.heroStats} num`} style={{ gridColumn: "10 / 13" }}>
          <div className={s.heroStatRow}>
            <span>Milestones</span>
            <span className={s.heroStatValue}>{data.counts.milestones}</span>
          </div>
          <div className={s.heroStatRow}>
            <span>Moments</span>
            <span className={s.heroStatValue}>{data.counts.moments}</span>
          </div>
          {data.yearRange && (
            <div className={s.heroStatRow}>
              <span>Years</span>
              <span className={s.heroStatValue}>{data.yearRange}</span>
            </div>
          )}
        </div>
      </div>

      {years.map(([year, milestones]) => (
        <section key={year}>
          <div className={s.yearBand}>
            <div className={`${s.yearNumeral} num`}>{year}</div>
          </div>
          {milestones.map((ms) => (
            <RegisterMilestone key={ms.id} ms={ms} viewer={viewer} />
          ))}
        </section>
      ))}

      {data.floatingMoments.length > 0 && (
        <section style={{ marginTop: 96 }}>
          <h3 className={s.sectionTitle}>Moments Between Milestones</h3>
          <p className={s.sectionNote}>
            Not everything belongs to a big event. These float freely on the
            timeline.
          </p>
          <div className={s.floatGrid}>
            {data.floatingMoments.map((m) => (
              <div key={m.id} className={s.momentRow} data-moment-id={m.id}>
                {m.media[0] && (
                  <Link href={`/moment/${m.id}`}>
                    <img className={s.floatThumb} src={m.media[0].url} alt="" loading="lazy" />
                  </Link>
                )}
                <div>
                  <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
                    <span className={s.momentCardTitle}>{m.title}</span>
                  </Link>
                  {excerpt(m) && (
                    <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
                      <div className={s.momentExcerpt}>{excerpt(m)}</div>
                    </Link>
                  )}
                  <div className={s.momentByline}>
                    {byline(m)} <EditLink viewer={viewer} m={m} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {undated.length > 0 && (
        <section style={{ marginTop: 96 }}>
          <h3 className={s.sectionTitle}>Awaiting Their Place in Time</h3>
          <p className={s.sectionNote}>
            Milestones we know happened — dates coming soon. Their moments are
            already gathering.
          </p>
          {undated
            .filter((ms) => ms.moments.length > 0)
            .map((ms) => (
              <RegisterMilestone key={ms.id} ms={ms} viewer={viewer} />
            ))}
          <div className={s.awaitList}>
            {undated
              .filter((ms) => ms.moments.length === 0)
              .map((ms) => (
                <span key={ms.id} className={s.awaitChip}>
                  {ms.title}
                </span>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
