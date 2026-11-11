import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

// next/font self-hosts these at build time (served from /_next/static/media),
// so the service worker precaches them and they work offline.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

// Inter for everything people read (names, buttons, labels); Cinzel only for big numerals and titles.
const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledger — MTG Life Counter",
  description: "Offline life counter for Magic: The Gathering.",
  applicationName: "Ledger",
  appleWebApp: { capable: true, title: "Ledger", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#14110d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cinzel.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
