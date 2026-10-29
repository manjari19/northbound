import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import FitDrawer from "@/components/FitDrawer";
import { Toaster } from "@/components/fx";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "northbound",
  description: "Internship and co-op postings in Canada and the US, plus a tracker, résumé checks and an interview plan.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#0a0d14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <Toaster />
        <FitDrawer />
        <footer className="footer">
          <div className="wrap">
            <span>northbound, built by Manjari Prasad.</span>
            <span>Postings from Simplify&apos;s community lists and company job boards.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
