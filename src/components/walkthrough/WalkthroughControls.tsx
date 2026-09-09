"use client";

import Link from "next/link";
import s from "./walkthrough.module.css";

// The play control in the Timeline's hero. The tour itself runs in the
// shell above the views (see WalkthroughPlayer).
export default function WalkthroughControls({
  stopCount,
  narrated,
  canEdit,
  onPlay,
}: {
  stopCount: number;
  narrated: boolean;
  canEdit: boolean;
  onPlay: () => void;
}) {
  return (
    <div className={s.playRow}>
      <button
        type="button"
        className={s.playBtn}
        onClick={onPlay}
        disabled={stopCount === 0}
        aria-label="Play the walkthrough"
      >
        <span className={s.playGlyph} aria-hidden="true" />
        Play the walkthrough
      </button>
      {canEdit && (
        <Link href="/walkthrough/edit" className={s.editLink}>
          Edit script
        </Link>
      )}
      <span className={s.playNote}>
        {stopCount === 0
          ? canEdit
            ? "No stops yet. Add some in the script."
            : "No stops yet."
          : `${stopCount} stop${stopCount === 1 ? "" : "s"}${narrated ? " · narrated" : ""}`}
      </span>
    </div>
  );
}
