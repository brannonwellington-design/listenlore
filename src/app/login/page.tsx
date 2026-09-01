import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const ERRORS: Record<string, string> = {
  domain: "That Google account isn’t a Listen Labs account. Sign in with your @listenlabs.ai email.",
  auth: "Sign-in didn’t complete — give it another try.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await getViewer()) redirect(next || "/");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 400, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 16, lineHeight: "24px" }}>
          <span>Listen Labs</span>
          <span style={{ color: "var(--content-disabled)" }}>/</span>
          <span style={{ color: "var(--content-secondary)" }}>Lore</span>
        </div>
        <h1 style={{ fontSize: 32, lineHeight: "36px" }}>Sign In to Add Moments</h1>
        <p style={{ fontSize: 14, lineHeight: "20px", color: "var(--content-secondary)" }}>
          Browsing is open to everyone here — signing in with your Listen Labs
          Google account lets you post moments and edit your own.
        </p>
        <GoogleSignInButton next={next} />
        {error && (
          <p style={{ fontSize: 14, lineHeight: "20px", color: "#B82214" }}>
            {ERRORS[error] ?? ERRORS.auth}
          </p>
        )}
        <Link href="/" style={{ fontSize: 14 }}>
          ← Back to the timeline
        </Link>
      </div>
    </div>
  );
}
