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
    "AI forensic & evidence-trust dashboard for Indian public data. Evidence-backed findings — not truth verdicts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} grain min-h-screen antialiased`}
      >
        <SiteNav />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-white/10 py-6">
          <p className="mx-auto max-w-7xl px-4 text-center text-xs tracking-wide text-slate-500 sm:px-6">
            Evidence-backed findings · Not truth verdicts
          </p>
        </footer>
      </body>
    </html>
  );
}
