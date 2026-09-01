"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "./timeline.module.css";

export interface ViewerInfo {
  userId: string;
  name: string;
  isAdmin: boolean;
}

function canEdit(viewer: ViewerInfo | null, m: Moment): boolean {
  return !!viewer && (viewer.isAdmin || m.created_by === viewer.userId);
}

type ViewMode = "register" | "record" | "album";

const VIEW_LABELS: Record<ViewMode, string> = {
  register: "Register",
  record: "Record",
  album: "Album",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function fmtDate(ms: Pick<Milestone, "date_start" | "date_end" | "date_precision">): string {
  if (!ms.date_start) return "Undated";
  const a = parts(ms.date_start);
  if (ms.date_end) {
    const b = parts(ms.date_end);
    if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}`;
    return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}`;
  }
  if (ms.date_precision === "day") return `${MONTHS[a.m - 1]} ${a.d}`;
  if (ms.date_precision === "year") return `${a.y}`;
  return `${MONTHS[a.m - 1]} ${a.y}`;
}

function fmtMomentDate(m: Moment): string | null {
  if (!m.event_date) return null;
  const a = parts(m.event_date);
  if (m.date_precision === "day") return `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  return `${MONTHS[a.m - 1]} ${a.y}`;
}

function byline(m: Moment): string {
  const bits: string[] = [];
  if (m.author) bits.push(m.author);
  const others = m.tagged.filter((t) => t !== m.author);
  if (others.length > 0) bits.push(`with ${others.join(", ")}`);
  const d = fmtMomentDate(m);
  if (d) bits.push(d);
  if (m.media.length > 1) bits.push(`${m.media.length} photos`);
  return bits.join(" · ");
}

function groupByYear(milestones: Milestone[]) {
  const dated = milestones.filter((m) => m.date_start);
  const years = new Map<string, Milestone[]>();
  for (const m of dated) {
    const y = m.date_start!.slice(0, 4);
    years.set(y, [...(years.get(y) ?? []), m]);
  }
  return [...years.entries()];
}

/* ------------------------------------------------------------------ */

export default function Timeline({
  data,
  viewer,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
}) {
  const [view, setView] = useState<ViewMode>("register");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lore-view");
      if (saved === "register" || saved === "record" || saved === "album") {
        setView(saved);
      }
    } catch {}
  }, []);

  const pick = (v: ViewMode) => {
    setView(v);
    try {
      window.localStorage.setItem("lore-view", v);
    } catch {}
  };

  return (
    <div className="wrap">
      <header className={s.header}>
        <div className={s.wordmark}>
          <span>Listen Labs</span>
          <span className={s.wordmarkSlash}>/</span>
          <span className={s.wordmarkSub}>Lore</span>
        </div>
        <div className={s.headerActions}>
          <div className={s.switcher} aria-label="Timeline view">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                className={`${s.switchBtn} ${view === v ? s.switchBtnActive : ""}`}
                onClick={() => pick(v)}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <Link href="/add" className={s.addBtn}>
            Add a Moment
          </Link>
          {viewer ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className={s.authNote}
                title={`Signed in as ${viewer.name}`}
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className={s.authNote}>
              Sign in
            </Link>
          )}
        </div>
      </header>
      <div key={view} className="viewfade">
        {view === "register" && <RegisterView data={data} viewer={viewer} />}
        {view === "record" && <RecordView data={data} viewer={viewer} />}
        {view === "album" && <AlbumView data={data} />}
      </div>
    </div>
  );
}

/* ---- A · The Register ------------------------------------------- */

function EditLink({ viewer, m }: { viewer: ViewerInfo | null; m: Moment }) {
  if (!canEdit(viewer, m)) return null;
  return (
    <Link
      href={`/moment/${m.id}/edit`}
      style={{ fontSize: 12, color: "var(--content-disabled)" }}
    >
      Edit
    </Link>
  );
}

function MomentRow({ m, viewer }: { m: Moment; viewer: ViewerInfo | null }) {
  return (
    <div className={s.momentRow}>
      {m.media[0] && (
        <img className={s.momentThumb} src={m.media[0].url} alt="" loading="lazy" />
      )}
      <div>
        <div className={s.momentTitle}>{m.title}</div>
        <div className={s.momentByline}>
          {byline(m)} <EditLink viewer={viewer} m={m} />
        </div>
      </div>
    </div>
  );
}

function RegisterMilestone({ ms, viewer }: { ms: Milestone; viewer: ViewerInfo | null }) {
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
        {ms.date_precision === "approx" && (
          <div className={s.metaApprox}>Approximate</div>
        )}
        <div className={s.metaSub}>
          {[ms.category, ms.location].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className={`${s.bandBody} ${expanded ? s.bandBodyWide : ""}`}>
        <h2 className={s.bandTitle}>{ms.title}</h2>
        {ms.blurb && <p className={s.bandBlurb}>{ms.blurb}</p>}
        {expanded ? (
          <div className={s.momentGrid}>
            {ms.moments.map((m) => (
              <div key={m.id} className={s.momentCard}>
                {m.media[0] && (
                  <img className={s.momentCardPhoto} src={m.media[0].url} alt="" loading="lazy" />
                )}
                <div className={s.momentCardTitle}>{m.title}</div>
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
          <img className={s.bandPhoto} src={hero.url} alt={ms.title} loading="lazy" />
        </figure>
      )}
    </div>
  );
}

function RegisterView({ data, viewer }: { data: TimelineData; viewer: ViewerInfo | null }) {
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
              <div key={m.id} className={s.momentRow}>
                {m.media[0] && (
                  <img className={s.floatThumb} src={m.media[0].url} alt="" loading="lazy" />
                )}
                <div>
                  <div className={s.momentCardTitle}>{m.title}</div>
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

/* ---- B · The Record ---------------------------------------------- */

function RecordRow({ ms, viewer }: { ms: Milestone; viewer: ViewerInfo | null }) {
  const [open, setOpen] = useState(false);
  const canOpen = ms.moments.length > 0;
  const dateCell = ms.date_start
    ? ms.date_precision === "approx"
      ? `${MONTHS[parts(ms.date_start).m - 1]} ≈`
      : fmtDate(ms)
    : "—";

  const rowContent = (
    <>
      <span className={`${s.recDate} num`}>{dateCell}</span>
        <span className={s.recCat}>{ms.upcoming ? "Upcoming" : ms.category}</span>
        <span className={s.recTitle}>{ms.title}</span>
        <span className={s.recLoc}>{ms.location}</span>
        <span className={s.recCount}>
          {ms.moments.length > 0
            ? `${ms.moments.length} moment${ms.moments.length > 1 ? "s" : ""} ${open ? "↑" : "↓"}`
            : ""}
        </span>
    </>
  );
  const rowClass = `grid12 ${s.recRow} ${ms.upcoming ? s.recUpcoming : ""}`;

  return (
    <div className={open ? s.recExpanded : undefined}>
      {canOpen ? (
        <button className={rowClass} onClick={() => setOpen(!open)} aria-expanded={open}>
          {rowContent}
        </button>
      ) : (
        <div className={rowClass}>{rowContent}</div>
      )}
      {open && (
        <div className={`grid12 ${s.recMoments}`}>
          <div className={s.recMomentList}>
            {ms.moments.map((m) => (
              <MomentRow key={m.id} m={m} viewer={viewer} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordView({ data, viewer }: { data: TimelineData; viewer: ViewerInfo | null }) {
  const years = groupByYear(data.milestones);
  const undated = data.milestones.filter((m) => !m.date_start);

  return (
    <div>
      <div className={`grid12 ${s.hero}`}>
        <div style={{ gridColumn: "1 / 7" }}>
          <h1 style={{ fontSize: 48, lineHeight: "52px" }}>The Record</h1>
        </div>
        <div style={{ gridColumn: "8 / 13", alignSelf: "end" }}>
          <p className={s.sectionNote}>
            A complete index of company history. Every row is a milestone; open
            one to read the moments underneath it.
          </p>
        </div>
      </div>

      {years.map(([year, milestones]) => (
        <section key={year}>
          <div className={s.recYear}>
            <div className={`${s.recYearNumeral} num`}>{year}</div>
          </div>
          {milestones.map((ms) => (
            <RecordRow key={ms.id} ms={ms} viewer={viewer} />
          ))}
        </section>
      ))}

      {undated.length > 0 && (
        <section>
          <div className={s.recYear}>
            <div className={s.recYearNumeral}>Undated</div>
          </div>
          {undated.map((ms) => (
            <RecordRow key={ms.id} ms={ms} viewer={viewer} />
          ))}
        </section>
      )}

      <div className={s.recNote}>
        ≈ marks approximate dates from the source archive. Owners can correct
        their own.
      </div>
    </div>
  );
}

/* ---- C · The Album ----------------------------------------------- */

function AlbumEntry({ ms, side }: { ms: Milestone; side: "left" | "right" }) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const heroMoment = ms.moments.find((m) => m.media[0]?.id === hero?.id);
  const extras = ms.moments
    .filter((m) => m.media[0] && m.media[0].id !== hero?.id)
    .slice(0, 4);

  const figure = hero && (
    <figure
      className={`${s.albumFigure} ${side === "left" ? s.albumFigureLeft : s.albumFigureRight}`}
    >
      <img className={s.albumPhoto} src={hero.url} alt={ms.title} loading="lazy" />
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
        {ms.date_precision === "approx" ? " ≈" : ""}
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
      {extras.length > 0 && (
        <div className={s.albumStrip}>
          {extras.map((m) => (
            <img
              key={m.id}
              className={s.albumStripThumb}
              src={m.media[0].url}
              alt={m.title}
              loading="lazy"
              title={m.title}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AlbumView({ data }: { data: TimelineData }) {
  const years = groupByYear(data.milestones.filter((m) => !m.upcoming));
  const upcoming = data.milestones.filter((m) => m.upcoming);
  let side: "left" | "right" = "left";

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
            {milestones.map((ms) => {
              const el = <AlbumEntry key={ms.id} ms={ms} side={side} />;
              side = side === "left" ? "right" : "left";
              return el;
            })}
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
