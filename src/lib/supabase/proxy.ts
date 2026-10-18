import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = new Set([
  "/login",
  "/signup",
  "/auth/callback",
  "/manifest.webmanifest",
  "/sw.js",
  "/.well-known/assetlinks.json",
]);

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  // These never redirect on sign-in state and check auth themselves (or need none), so skip the
  // auth round trip: the AI routes call requireAiUser, and the auth routes exchange their own code.
  const early = request.nextUrl.pathname;
  if (
    early.startsWith("/api/") ||
    early.startsWith("/auth/") ||
    early.startsWith("/.well-known/") ||
    early === "/sw.js" ||
    early === "/manifest.webmanifest"
  ) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    PUBLIC.has(path) ||
    path.startsWith("/auth/") ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/ai/") ||
    path.startsWith("/.well-known/");

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  if (user && (path === "/login" || path === "/signup" || path === "/")) {
    const home = request.nextUrl.clone();
    home.pathname = "/home";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
