"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Milestone } from "@/lib/types";
import { MAX_PHOTOS_PER_MOMENT } from "@/lib/upload";
import AddPhotos from "../AddPhotos";
import t from "../timeline.module.css";
import s from "./event.module.css";
import {
  aspect,
  MediaEl,
  CategoryChip,
  fmtDate,
  MomentCard,
  type ViewerInfo,
} from "../timeline/shared";

function yearOf(ms: Milestone): string | null {
  return ms.date_start ? ms.date_start.slice(0, 4) : null;
}

export default function EventDetail({
  ms,
  viewer,
}: {
  ms: Milestone;
  viewer: ViewerInfo | null;
}) {
  const hero = ms.media[0] ?? ms.moments.find((m) => m.media.length > 0)?.media[0];
  const gallery = ms.media.slice(1);
  const count = ms.moments.length;
  const addHref = `/add?event=${ms.id}`;

  // Landing here after saving: bring the new moment into view and let it
  // glow for a beat, the same way the timeline does.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    if (!added) return;
    params.delete("added");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-moment-id="${added}"]`);
      if (!el) return;
      el.classList.add(t.justAdded);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
  }, []);

  return (
    <div className={`wrap ${s.page}`}>
      <nav className={s.crumbs}>
        <Link href="/" className={s.crumb}>
          ← Back to the timeline
        </Link>
      </nav>

      <header className={`grid12 ${s.header}`}>
        <div className={s.meta}>
          {yearOf(ms) && <div className={`${s.metaYear} num`}>{yearOf(ms)}</div>}
          <div className={`${s.metaDate} num`}>{fmtDate(ms)}</div>
          {ms.upcoming && <div className={s.metaUpcoming}>Upcoming</div>}
          {ms.date_precision === "approx" && ms.date_start && (
            <div className={s.metaSub}>Approximate</div>
          )}
          {ms.location && <div className={s.metaSub}>{ms.location}</div>}
          <CategoryChip label={ms.category} />
        </div>

        <div className={`${s.body} ${hero ? "" : s.bodyWide}`}>
          <h1 className={s.title}>{ms.title}</h1>
          {ms.blurb && <p className={s.blurb}>{ms.blurb}</p>}
          {ms.story && <p className={s.story}>{ms.story}</p>}
          <div className={s.actions}>
            {viewer ? (
              <Link href={addHref} className={s.addBtn}>
                {count === 0 ? "Add the first moment" : "Add a moment to this event"}
              </Link>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(addHref)}`}
                className={s.addBtn}
              >
                Sign in to add a moment
              </Link>
            )}
            <span className={s.count}>
              {count === 0
                ? "No moments yet"
                : `${count} moment${count === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {hero && (
          <figure className={s.figure}>
            <MediaEl
              media={hero}
              controls={hero.kind === "video"}
              className={s.heroPhoto}
              style={{ aspectRatio: aspect(hero, 3 / 4, 3 / 2) }}
              alt={ms.title}
            />
            {hero.caption && (
              <figcaption className={s.caption}>{hero.caption}</figcaption>
            )}
          </figure>
        )}
      </header>

      {(gallery.length > 0 || viewer) && (
        <div className={s.gallery}>
          {gallery.map((m) => (
            <MediaEl
              key={m.id}
              media={m}
              controls={m.kind === "video"}
              className={s.galleryPhoto}
              style={{ aspectRatio: aspect(m, 3 / 4, 8 / 5) }}
              alt={m.caption ?? ""}
            />
          ))}
          {viewer && (
            <div className={s.galleryAdd}>
              <AddPhotos
                milestoneId={ms.id}
                remaining={MAX_PHOTOS_PER_MOMENT - ms.media.length}
              />
            </div>
          )}
        </div>
      )}

      <section className={s.moments}>
        <div className={s.momentsHead}>
          <h2 className={s.momentsTitle}>
            {count === 0 ? "Moments" : "What people remember"}
          </h2>
          {viewer && count > 0 && (
            <Link href={addHref} className={s.momentsAdd}>
              + Add yours
            </Link>
          )}
        </div>
        {count === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyLead}>
              Nothing has been added to this event yet.
            </p>
            <p className={s.emptyNote}>
              {viewer
                ? "Were you there? A photo, a line, an inside joke — anything counts."
                : "Sign in to add the first one."}
            </p>
          </div>
        ) : (
          <div className={s.grid}>
            {ms.moments.map((m) => (
              <MomentCard key={m.id} m={m} viewer={viewer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
