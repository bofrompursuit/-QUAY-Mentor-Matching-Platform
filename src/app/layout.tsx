import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "QUAY Mentor Matching" };

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
