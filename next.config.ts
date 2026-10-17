import type { NextConfig } from "next";

// Only this project's Supabase storage may go through the image optimizer, not any
// *.supabase.co project. NEXT_PUBLIC_SUPABASE_URL is set at build time on Vercel.
function supabaseImagePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol !== "https:") return [];
    return [{ protocol: "https", hostname: url.hostname, pathname: "/storage/v1/**" }];
  } catch {
    return [];
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // frame-ancestors only: a full CSP would block Next's inline scripts.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Camera (receipt photos) and microphone (voice entry) stay available to this origin.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...supabaseImagePatterns(),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
