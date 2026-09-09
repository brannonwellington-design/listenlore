"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineData } from "@/lib/types";
import type { Walkthrough } from "@/lib/walkthrough";
import WalkthroughPlayer, { type TourView } from "../walkthrough/WalkthroughPlayer";
import GridOverlay from "../GridOverlay";
import s from "../timeline.module.css";
import AlbumView from "./AlbumView";
import ConstellationView from "./ConstellationView";
import GridView from "./GridView";
import RecordView from "./RecordView";
import RegisterView from "./RegisterView";
import type { ViewerInfo } from "./shared";

type ViewMode = "register" | "record" | "album" | "grid" | "constellation";

const VIEW_LABELS: Record<ViewMode, string> = {
  register: "Register",
  record: "Record",
  album: "Timeline",
  grid: "Grid",
  constellation: "Nodes",
};

// The URL spells the album view "timeline"; older links still say
// "album" and keep working.
const URL_NAMES: Record<ViewMode, string> = {
  register: "register",
  record: "record",
  album: "timeline",
  grid: "grid",
  constellation: "constellation",
};
function fromUrlName(v: string | null): string | null {
  return v === "timeline" ? "album" : v;
}

// Register and Record are parked for now: not in the switcher, not a
// default, but still reachable by ?view= so nothing is thrown away.
const HIDDEN_VIEWS: ReadonlySet<ViewMode> = new Set(["register", "record"]);
const SHOWN_VIEWS = (Object.keys(VIEW_LABELS) as ViewMode[]).filter(
  (v) => !HIDDEN_VIEWS.has(v)
);
const DEFAULT_VIEW: ViewMode = "album";

function isView(v: string | null): v is ViewMode {
  return (
    v === "register" ||
    v === "record" ||
    v === "album" ||
    v === "grid" ||
    v === "constellation"
  );
}
function isShownView(v: string | null): v is ViewMode {
  return isView(v) && !HIDDEN_VIEWS.has(v);
}

function scrollToMoment(ids: string) {
  const list = ids.split(",").filter(Boolean);
  let first: Element | null = null;
  for (const id of list) {
    const el = document.querySelector(`[data-moment-id="${id}"]`);
    if (!el) continue;
    if (!first) first = el;
    el.classList.add(s.justAdded);
  }
  if (!first) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  first.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}

export default function Timeline({
  data,
  viewer,
  walkthrough,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
  walkthrough: Walkthrough;
}) {
  const [view, setView] = useState<ViewMode>(DEFAULT_VIEW);

  // The walkthrough runs in this shell so it survives its own trips
  // through the Grid and the Nodes.
  const [touring, setTouring] = useState(false);
  const allMoments = useMemo(
    () => [...data.milestones.flatMap((ms) => ms.moments), ...data.floatingMoments],
    [data]
  );
  const stopCount = walkthrough.items.filter((it) => it.kind === "stop").length;
  const tourView = useCallback((v: TourView) => setView(v), []);
  const endTour = useCallback(() => {
    setTouring(false);
    setView("album");
  }, []);
  const scrollMemory = useRef<Partial<Record<ViewMode, number>>>({});
  const restoreTo = useRef<number | null>(null);
  const pendingAdded = useRef<string | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // On load: ?view= in the URL wins, then the viewer's saved preference
  // (a saved preference for a parked view falls back to the default).
  // A fresh ?added= submission lands on the default view and scrolls to
  // the new moment where it appears there. Deferred a frame so the first
  // client render matches the server HTML.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    const fromUrl = fromUrlName(params.get("view"));
    requestAnimationFrame(() => {
      if (added) {
        params.delete("added");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
        if (viewRef.current === DEFAULT_VIEW) {
          // Already on the default view — scroll straight away.
          scrollToMoment(added);
        } else {
          pendingAdded.current = added;
          setView(DEFAULT_VIEW);
        }
      } else if (isView(fromUrl)) {
        setView(fromUrl);
      } else {
        try {
          const saved = fromUrlName(window.localStorage.getItem("lore-view"));
          if (isShownView(saved)) setView(saved);
        } catch {}
      }
    });
  }, []);

  // After a view renders: restore that view's remembered scroll, or
  // bring a freshly added moment into focus.
  useEffect(() => {
    if (restoreTo.current !== null) {
      window.scrollTo({ top: restoreTo.current, behavior: "auto" });
      restoreTo.current = null;
    }
    if (view === DEFAULT_VIEW && pendingAdded.current) {
      const added = pendingAdded.current;
      pendingAdded.current = null;
      requestAnimationFrame(() => scrollToMoment(added));
    }
  }, [view]);

  const pick = (v: ViewMode) => {
    if (v === view) return;
    scrollMemory.current[view] = window.scrollY;
    restoreTo.current = scrollMemory.current[v] ?? 0;
    setView(v);
    try {
      window.localStorage.setItem("lore-view", v);
    } catch {}
    const params = new URLSearchParams(window.location.search);
    params.set("view", URL_NAMES[v]);
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  return (
    <div className={`wrap ${s.shell}`}>
      <GridOverlay />
      <header className={s.header}>
        <div className={s.wordmark}>
          <span>Listen Labs</span>
          <span className={s.wordmarkSlash}>/</span>
          <span className={s.wordmarkSub}>Lore</span>
        </div>
        <div className={s.switcher} aria-label="Timeline view">
            {SHOWN_VIEWS.map((v) => (
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
        <div className={s.headerActions}>
          <Link href="/add" className={s.addBtn}>
            Add a Moment
          </Link>
          {viewer ? (
            <form action="/auth/signout" method="post" className={s.authNote}>
              <span className={s.authName}>{viewer.name} · </span>
              <button type="submit" className={s.authNoteBtn}>
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
        {view === "album" && (
          <AlbumView
            data={data}
            canEdit={!!viewer}
            tour={{
              stopCount,
              narrated: !!walkthrough.audioUrl,
              onPlay: () => setTouring(true),
            }}
          />
        )}
        {view === "grid" && <GridView data={data} drift={touring} />}
        {view === "constellation" && (
          <ConstellationView data={data} forceIntro={touring} />
        )}
      </div>
      <WalkthroughPlayer
        script={walkthrough}
        milestones={data.milestones}
        moments={allMoments}
        running={touring}
        view={view === "grid" || view === "constellation" ? view : "album"}
        onView={tourView}
        onEnd={endTour}
      />
    </div>
  );
}
