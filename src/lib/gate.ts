const GATE_SALT = "listenlore-gate-v1";

export const GATE_COOKIE = "lore-gate";

export async function gateHash(passcode: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${GATE_SALT}:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
