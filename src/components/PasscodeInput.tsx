"use client";

import { useState } from "react";

export default function PasscodeInput() {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ flex: 1, position: "relative", display: "flex" }}>
      <input
        type={visible ? "text" : "password"}
        name="passcode"
        autoFocus
        aria-label="Passcode"
        style={{
          flex: 1,
          font: "inherit",
          padding: "12px 64px 12px 16px",
          border: "1px solid var(--surface-tertiary)",
          borderRadius: 8,
          background: "var(--surface-highlight)",
          color: "var(--content-primary)",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-pressed={visible}
        style={{
          position: "absolute",
          right: 12,
          top: 0,
          bottom: 0,
          fontSize: 12,
          color: "var(--content-secondary)",
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
