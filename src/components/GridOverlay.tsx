"use client";

import { useEffect, useState } from "react";
import g from "./grid.module.css";

const COLS = 12;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

// Display type's ink sits inside its box by the glyph's side-bearing, so a
// headline whose box is on the column line looks a hair off it. Measure
// the loaded font and nudge each [data-optical] element so the INK lands
// on the line. Re-runs when fonts load and on resize.
function alignInk() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.querySelectorAll<HTMLElement>("[data-optical]").forEach((el) => {
    el.style.marginLeft = "0px";
    const cs = getComputedStyle(el);
    let ch = (el.textContent ?? "").trim()[0];
    if (!ch) return;
    if (cs.textTransform === "uppercase") ch = ch.toUpperCase();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textAlign = "left";
    const abl = ctx.measureText(ch).actualBoundingBoxLeft;
    if (Number.isFinite(abl)) el.style.marginLeft = `${abl.toFixed(2)}px`;
  });
}

// The grid the page is built on, drawn from the same tokens the content
// uses and living in the same .wrap box, so its columns ARE the content
// columns at every width. Press G to see it.
export default function GridOverlay() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      setOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(alignInk);
    };
    run();
    document.fonts?.ready.then(run);
    window.addEventListener("resize", run);
    const mo = new MutationObserver(run);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", run);
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={g.guides} data-on={on ? "" : undefined} aria-hidden="true">
      <div className={g.cols}>
        {Array.from({ length: COLS }, (_, i) => (
          <div key={i} className={g.col}>
            <span className={`${g.colNum} num`}>{i + 1}</span>
          </div>
        ))}
      </div>
      <div className={`${g.marginLine} ${g.marginLeft}`} />
      <div className={`${g.marginLine} ${g.marginRight}`} />
      <div className={g.legend}>
        <span className="num">{COLS} col · 24 gutter · 8 baseline</span>
        <span>G to hide</span>
      </div>
    </div>
  );
}
