import "server-only";
import { createClient } from "@supabase/supabase-js";

// In environments that route egress through an HTTP proxy (the Claude Code
// dev sandbox), Node's fetch ignores HTTPS_PROXY — undici's dispatcher makes
// it comply. Vercel sets no HTTPS_PROXY, so this is inert in production.
function proxyFetch(): typeof fetch | undefined {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!proxy) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProxyAgent, fetch: undiciFetch } = require("undici");
  const dispatcher = new ProxyAgent(proxy);
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    undiciFetch(input as never, {
      ...(init as object),
      dispatcher,
    })) as unknown as typeof fetch;
}

// Server-only client with the secret key: bypasses RLS. Use for reads that
// back public pages and for storage operations; user-attributed writes go
// through the session client so RLS stays the authority.
export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false }, global: { fetch: proxyFetch() } }
  );
}
