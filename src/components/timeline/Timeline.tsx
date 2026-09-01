"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TimelineData } from "@/lib/types";
import s from "../timeline.module.css";
import AlbumView from "./AlbumView";
import ConstellationView from "./ConstellationView";
import RecordView from "./RecordView";
import RegisterView from "./RegisterView";
import type { ViewerInfo } from "./shared";

type ViewMode = "register" | "record" | "album" | "constellation";

const VIEW_LABELS: Record<ViewMode, string> = {
  register: "Register",
  record: "Record",
  album: "Album",
  constellation: "Nodes",
};

function isView(v: string | null): v is ViewMode {
  return (
    v === "register" || v === "record" || v === "album" || v === "constellation"
  );
}

function scrollToMoment(id: string) {
  const el = document.querySelector(`[data-moment-id="${id}"]`);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.classList.add(s.justAdded);
}

export default function Timeline({
  data,
  viewer,
}: {
  data: TimelineData;
  viewer: ViewerInfo | null;
}) {
  const [view, setView] = useState<ViewMode>("register");
  const scrollMemory = useRef<Partial<Record<ViewMode, number>>>({});
  const restoreTo = useRef<number | null>(null);
  const pendingAdded = useRef<string | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // On load: ?view= in the URL wins, then the viewer's saved preference.
  // A fresh ?added= submission always lands on Register, where every
  // moment is guaranteed visible. Deferred a frame so the first client
  // render matches the server HTML.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const added = params.get("added");
    const fromUrl = params.get("view");
    requestAnimationFrame(() => {
      if (added) {
        params.delete("added");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
        if (viewRef.current === "register") {
          // Already on Register (the default) — scroll straight away.
          scrollToMoment(added);
        } else {
          pendingAdded.current = added;
          setView("register");
        }
      } else if (isView(fromUrl)) {
        setView(fromUrl);
      } else {
        try {
          const saved = window.localStorage.getItem("lore-view");
          if (isView(saved)) setView(saved);
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
    if (view === "register" && pendingAdded.current) {
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
    params.set("view", v);
    window.history.replaceState(null, "", `?${params.toString()}`);
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
            <form action="/auth/signout" method="post" className={s.authNote}>
              {viewer.name} ·{" "}
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
        {view === "album" && <AlbumView data={data} />}
        {view === "constellation" && <ConstellationView data={data} />}
      </div>
    </div>
  );
}
