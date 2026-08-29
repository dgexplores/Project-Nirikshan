import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Bharat Data Detective",
    template: "%s · Bharat Data Detective",
  },
  description:
    "Check your data for problems, in plain language. Upload a file, see what looks off, and get proof for every answer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteNav />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-[var(--border)] py-6">
          <p className="mx-auto max-w-7xl px-4 text-center text-xs tracking-wide text-[var(--foreground-faint)] sm:px-6">
            We point out things worth checking. You always decide what&apos;s true.
          </p>
        </footer>
      </body>
    </html>
  );
}
