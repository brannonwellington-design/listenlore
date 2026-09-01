import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { ALLOWED_DOMAIN } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const email = data.user.email ?? "";
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Link (or create) this user's people row so authorship and tagging
  // resolve to one identity. Seeded rows match on email.
  const service = serviceClient();
  const fullName =
    (data.user.user_metadata?.full_name as string) ??
    (data.user.user_metadata?.name as string) ??
    email.split("@")[0];

  const { data: existing } = await service
    .from("people")
    .select("id, auth_user_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (!existing.auth_user_id) {
      await service
        .from("people")
        .update({ auth_user_id: data.user.id })
        .eq("id", existing.id);
    }
  } else {
    // No email match — this person may already exist as an unclaimed row
    // created by someone tagging them before their first sign-in. Claim it
    // when exactly one unclaimed row matches their name (full name, or
    // unique first name); ambiguity falls through to a fresh row that an
    // admin can merge later.
    const { data: unclaimed } = await service
      .from("people")
      .select("id, full_name")
      .is("auth_user_id", null)
      .is("email", null);
    const wanted = fullName.trim().toLowerCase();
    const first = wanted.split(" ")[0];
    const matches = (unclaimed ?? []).filter((p) => {
      const n = p.full_name.trim().toLowerCase();
      return n === wanted || n === first;
    });

    if (matches.length === 1) {
      await service
        .from("people")
        .update({ full_name: fullName, email, auth_user_id: data.user.id })
        .eq("id", matches[0].id);
    } else {
      await service.from("people").insert({
        full_name: fullName,
        email,
        auth_user_id: data.user.id,
      });
    }
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
}
