import type { SupabaseClient, User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export function displayNameFromUser(user: User | null): string {
  if (!user) return "You";
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "You"
  );
}

export function avatarFromUser(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url || meta.picture;
  return typeof url === "string" && url ? url : null;
}

export async function loadProfile(supabase: SupabaseClient, user: User): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    full_name: data?.full_name ?? displayNameFromUser(user),
    avatar_url: data?.avatar_url ?? avatarFromUser(user),
    email: user.email ?? null,
  };
}

export async function saveProfile(
  supabase: SupabaseClient,
  userId: string,
  input: { full_name: string; householdId: string; householdName: string },
) {
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: input.full_name.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (profileError) throw profileError;

  const { error: homeError } = await supabase
    .from("households")
    .update({ name: input.householdName.trim() || "My Home" })
    .eq("id", input.householdId);
  if (homeError) throw homeError;

  await supabase.auth.updateUser({ data: { full_name: input.full_name.trim() } });
}
