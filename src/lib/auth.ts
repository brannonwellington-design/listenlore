import "server-only";
import { createClient as createUserClient } from "./supabase/server";

export const ALLOWED_DOMAIN = "listenlabs.ai";

export interface Viewer {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// The signed-in viewer, or null. Domain enforcement happens at sign-in
// (auth callback), but is re-checked here as a belt-and-braces guard.
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email.endsWith(`@${ALLOWED_DOMAIN}`)) return null;

  const { data: admin } = await supabase
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  const name =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    user.email.split("@")[0];

  return { userId: user.id, email: user.email, name, isAdmin: !!admin };
}
