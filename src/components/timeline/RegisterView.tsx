import Link from "next/link";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  aspect,
  byline,
  CategoryChip,
  clusterDateLabel,
  clusterEntries,
  EditLink,
  excerpt,
  fmtDate,
  fmtMomentDate,
  groupTimelineByYear,
  MomentCard,
  MomentRow,
  undatedFloating,
  type ViewerInfo,
} from "./shared";
import type { ClusteredEntry } from "./shared";

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
        {ms.location && <div className={s.metaSub}>{ms.location}</div>}
        <CategoryChip label={ms.category} />
      </div>
      <div
        className={`${s.bandBody} ${expanded || !hero ? s.bandBodyWide : ""}`}
      >
        <h2 className={s.bandTitle}>{ms.title}</h2>
        {ms.blurb && <p className={s.bandBlurb}>{ms.blurb}</p>}
        {expanded ? (
          <div className={s.momentGrid}>
            {ms.moments.map((m) => (
              <MomentCard key={m.id} m={m} viewer={viewer} />
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

// Free-floating moments between milestones: one alone gets a full band; a
// run of them shares one band with a card mosaic, so the register keeps its
// rhythm — big beats for milestones, dense clusters for the chatter between.
function FloatingMomentBand({
  m,
  viewer,
}: {
  m: Moment;
  viewer: ViewerInfo | null;
}) {
  const quote = excerpt(m, 220);
  return (
    <div className={`grid12 ${s.band}`} data-moment-id={m.id}>
      <div className={s.bandMeta}>
        <div className={`${s.metaDate} num`}>{fmtMomentDate(m) ?? "Undated"}</div>
        {m.location && <div className={s.metaSub}>{m.location}</div>}
        <CategoryChip label={m.category} />
      </div>
      <div className={`${s.bandBody} ${s.floatBandBody}`}>
        <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
          <h2 className={s.floatBandTitle}>{m.title}</h2>
        </Link>
        {m.media[0] ? (
          <Link href={`/moment/${m.id}`}>
            <img
              className={s.floatBandPhoto}
              style={{ aspectRatio: aspect(m.media[0]) }}
              src={m.media[0].url}
              alt=""
              loading="lazy"
            />
          </Link>
        ) : (
          quote && (
            <Link href={`/moment/${m.id}`} className={s.momentTitleLink}>
              <div className={s.quoteBlock}>
                <div className={s.quoteClamp}>{quote}</div>
              </div>
            </Link>
          )
        )}
        <div className={s.momentByline}>
          {byline(m)} <EditLink viewer={viewer} m={m} />
        </div>
      </div>
    </div>
  );
}

function FloatingClusterBand({
  moments,
  viewer,
}: {
  moments: Moment[];
  viewer: ViewerInfo | null;
}) {
  if (moments.length === 1) {
    return <FloatingMomentBand m={moments[0]} viewer={viewer} />;
  }
  return (
    <div className={`grid12 ${s.band}`}>
      <div className={s.bandMeta}>
        <div className={`${s.metaDate} num`}>{clusterDateLabel(moments)}</div>
        <div className={s.metaSub}>
          {moments.length} moments between milestones
        </div>
      </div>
      <div className={`${s.bandBody} ${s.bandBodyWide}`}>
        <div className={s.momentGrid}>
          {moments.map((m) => (
            <MomentCard key={m.id} m={m} viewer={viewer} />
          ))}
        </div>
      </div>
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
  const years: [string, ClusteredEntry[]][] = groupTimelineByYear(data).map(
    ([year, entries]) => [year, clusterEntries(entries)]
  );
  const undated = data.milestones.filter((m) => !m.date_start);
  const undatedMoments = undatedFloating(data);

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

      {years.map(([year, entries]) => (
        <section key={year}>
          <div className={s.yearBand}>
            <div className={`${s.yearNumeral} num`}>{year}</div>
          </div>
          {entries.map((e) =>
            e.kind === "milestone" ? (
              <RegisterMilestone key={e.ms.id} ms={e.ms} viewer={viewer} />
            ) : (
              <FloatingClusterBand
                key={e.moments[0].id}
                moments={e.moments}
                viewer={viewer}
              />
            )
          )}
        </section>
      ))}

      {undatedMoments.length > 0 && (
        <section style={{ marginTop: 96 }}>
          <h3 className={s.sectionTitle}>Moments Awaiting a Date</h3>
          <p className={s.sectionNote}>
            These will join the timeline once someone pins down when they
            happened.
          </p>
          <div className={s.floatGrid}>
            {undatedMoments.map((m) => (
              <MomentRow key={m.id} m={m} viewer={viewer} />
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
