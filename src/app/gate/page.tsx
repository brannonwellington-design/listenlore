import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GATE_COOKIE, gateHash } from "@/lib/gate";
import PasscodeInput from "@/components/PasscodeInput";

async function unlock(formData: FormData) {
  "use server";
  const attempt = String(formData.get("passcode") ?? "");
  const passcode = process.env.SITE_PASSCODE;
  if (!passcode || attempt !== passcode) {
    redirect("/gate?error=1");
  }
  const jar = await cookies();
  jar.set(GATE_COOKIE, await gateHash(passcode), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 16, lineHeight: "24px" }}>
          <span>Listen Labs</span>
          <span style={{ color: "var(--content-disabled)" }}>/</span>
          <span style={{ color: "var(--content-secondary)" }}>Lore</span>
        </div>
        <p style={{ fontSize: 14, lineHeight: "20px", color: "var(--content-secondary)" }}>
          This timeline is for Listen Labs. Enter the team passcode to continue.
        </p>
        <form action={unlock} style={{ display: "flex", gap: 8 }}>
          <PasscodeInput />
          <button
            type="submit"
            style={{
              background: "var(--surface-brand-primary)",
              color: "var(--content-brand-contrast)",
              padding: "12px 24px",
              borderRadius: 8,
            }}
          >
            Enter
          </button>
        </form>
        {error && (
          <p style={{ fontSize: 14, lineHeight: "20px", color: "#B82214" }}>
            That passcode isn’t right — try again.
          </p>
        )}
        <p style={{ fontSize: 12, lineHeight: "16px", color: "var(--content-secondary)" }}>
          This device stays unlocked for 30 days.
        </p>
      </div>
    </div>
  );
}
