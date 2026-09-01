import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { GATE_COOKIE, gateHash } from "@/lib/gate";

// Site-wide passcode wall (covers every domain, unlike Vercel's
// password protection, which exempts custom domains on this plan).
// Active only when SITE_PASSCODE is set; removed once real SSO lands.
export async function proxy(request: NextRequest) {
  const passcode = process.env.SITE_PASSCODE;
  const { pathname } = request.nextUrl;

  if (passcode && pathname !== "/gate") {
    const cookie = request.cookies.get(GATE_COOKIE)?.value;
    if (cookie !== (await gateHash(passcode))) {
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return updateSession(request, NextResponse.next({ request }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
