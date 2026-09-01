"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { hd: "listenlabs.ai", prompt: "select_account" },
      },
    });
    if (error) {
      setError(
        "Google sign-in isn’t switched on yet — it’s being set up. Check back soon."
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={signIn}
        style={{
          background: "var(--surface-brand-primary)",
          color: "var(--content-brand-contrast)",
          fontSize: 16,
          lineHeight: "24px",
          padding: "12px 24px",
          borderRadius: 8,
          alignSelf: "flex-start",
        }}
      >
        Continue with Google
      </button>
      {error && (
        <p style={{ fontSize: 14, lineHeight: "20px", color: "var(--content-secondary)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
