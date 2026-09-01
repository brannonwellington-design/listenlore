"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F9F4EB",
        color: "#120F08",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 16, lineHeight: "24px" }}>
          <span>Listen Labs</span>
          <span style={{ color: "#B6B4AF" }}>/</span>
          <span style={{ color: "#6B6861" }}>Lore</span>
        </div>
        <h1 style={{ fontSize: 32, lineHeight: "36px", margin: 0, fontWeight: 400 }}>
          The Timeline Hit a Snag
        </h1>
        <p style={{ fontSize: 14, lineHeight: "20px", color: "#6B6861", margin: 0 }}>
          Something went wrong loading the history. It’s usually momentary.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#0021CC",
            color: "#F9F4EB",
            font: "inherit",
            fontSize: 16,
            lineHeight: "24px",
            padding: "12px 24px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
