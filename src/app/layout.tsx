import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QUAY Mentor Matching",
  applicationName: "QUAY Mentors",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "QUAY", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <b>QUAY Mentors</b>
          <Link href="/">Dashboard</Link>
          <Link href="/mentors">Mentors</Link>
          <Link href="/sessions">Sessions</Link>
          <Link href="/startups">Startup requests</Link>
          <Link href="/requests">Request inbox</Link>
          <Link href="/flags">Data health</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
