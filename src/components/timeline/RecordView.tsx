"use client";

import { useState } from "react";
import type { Milestone, TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import {
  fmtDate,
  groupByYear,
  MomentRow,
  MONTHS,
  parts,
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

export default function RecordView({
  data,
  viewer,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
}) {
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
