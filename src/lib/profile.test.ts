import { describe, expect, it } from "vitest";
import { avatarFromUser, displayNameFromUser } from "./profile";
import type { User } from "@supabase/supabase-js";

function user(partial: Partial<User> & { user_metadata?: User["user_metadata"] }): User {
  return {
    id: "u1",
    email: "friend@example.com",
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  } as User;
}

describe("profile", () => {
  it("prefers Google name, then email", () => {
    expect(displayNameFromUser(user({ user_metadata: { full_name: "Asha Rao" } }))).toBe("Asha Rao");
    expect(displayNameFromUser(user({ user_metadata: { name: "Asha" } }))).toBe("Asha");
    expect(displayNameFromUser(user({ user_metadata: {} }))).toBe("friend");
    expect(displayNameFromUser(null)).toBe("You");
  });

  it("reads Google avatar from metadata", () => {
    expect(avatarFromUser(user({ user_metadata: { picture: "https://lh3.googleusercontent.com/a" } }))).toBe(
      "https://lh3.googleusercontent.com/a",
    );
    expect(avatarFromUser(user({ user_metadata: {} }))).toBeNull();
  });
});
