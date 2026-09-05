"use client";

import { useState } from "react";
import Link from "next/link";
import type { Milestone, Moment, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  fmtDate,
  groupTimelineByYear,
  MomentRow,
  MONTHS,
  parts,
  undatedFloating,
  type ViewerInfo,
} from "./shared";

function RecordRow({
  ms,
  viewer,
}: {
  ms: Milestone;
  viewer: ViewerInfo | null;
}) {
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
      <span className={s.recTitle}>
        <Link
          href={`/milestone/${ms.id}`}
          className={s.momentTitleLink}
          onClick={(e) => e.stopPropagation()}
        >
          {ms.title}
        </Link>
      </span>
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
        <div
          className={rowClass}
          onClick={() => setOpen(!open)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(!open);
            }
          }}
          aria-expanded={open}
        >
          {rowContent}
        </div>
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

// Free-floating moments are rows in the same ledger — lighter ink, same
// columns, and the whole row opens the moment.
function RecordMomentRow({ m }: { m: Moment }) {
  const p = m.event_date ? parts(m.event_date) : null;
  const dateCell = p
    ? m.date_precision === "day"
      ? `${MONTHS[p.m - 1]} ${p.d}`
      : `${MONTHS[p.m - 1]} ≈`
    : "—";
  return (
    <Link
      href={`/moment/${m.id}`}
      className={`grid12 ${s.recRow} ${s.recMomentRow}`}
      data-moment-id={m.id}
    >
      <span className={`${s.recDate} num`}>{dateCell}</span>
      <span className={s.recCat}>{m.category ?? "Moment"}</span>
      <span className={`${s.recTitle} ${s.recMomentTitle}`}>{m.title}</span>
      <span className={s.recLoc}>{m.location}</span>
      <span className={s.recCount}>
        <span className={s.recByAuthor}>{m.author ? `by ${m.author}` : "moment"}</span> →
      </span>
    </Link>
  );
}

export default function RecordView({
  data,
  viewer,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
}) {
  const years = groupTimelineByYear(data);
  const undated = data.milestones.filter((m) => !m.date_start);
  const undatedMoments = undatedFloating(data);

  return (
    <div>
      <div className={`grid12 ${s.hero}`}>
        <div style={{ gridColumn: "1 / 7" }}>
          <h1 style={{ fontSize: 48, lineHeight: "52px" }}>The Record</h1>
        </div>
        <div style={{ gridColumn: "8 / 13", alignSelf: "end" }}>
          <p className={s.sectionNote}>
            A complete index of company history — milestones and free-floating
            moments in one ledger. Open a milestone to read the moments
            underneath it.
          </p>
        </div>
      </div>

      {years.map(([year, entries]) => (
        <section key={year}>
          <div className={s.recYear}>
            <div className={`${s.recYearNumeral} num`}>{year}</div>
          </div>
          {entries.map((e) =>
            e.kind === "milestone" ? (
              <RecordRow key={e.ms.id} ms={e.ms} viewer={viewer} />
            ) : (
              <RecordMomentRow key={e.m.id} m={e.m} />
            )
          )}
        </section>
      ))}

      {(undated.length > 0 || undatedMoments.length > 0) && (
        <section>
          <div className={s.recYear}>
            <div className={s.recYearNumeral}>Undated</div>
          </div>
          {undated.map((ms) => (
            <RecordRow key={ms.id} ms={ms} viewer={viewer} />
          ))}
          {undatedMoments.map((m) => (
            <RecordMomentRow key={m.id} m={m} />
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
