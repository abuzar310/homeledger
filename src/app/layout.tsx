import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import { THEME_COLOR, themeScript } from "@/lib/theme";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HomeLedger",
  description: "Simple spending. A better home.",
  applicationName: "HomeLedger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HomeLedger",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // A Light / Dark choice saved in Settings adds its own theme-color meta ahead of these.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The head script sets data-theme before React hydrates; let the DOM win.
    <html lang="en-IN" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-bg font-sans text-ink">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
