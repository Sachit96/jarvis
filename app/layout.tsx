import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// Inter for everything functional: body, controls, labels, tables. The
// contrast against Clash Display headings is the point — a display face set
// at 14px in a table is unreadable, and a UI face at 60px is characterless.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "JARVIS",
  description: "Personal command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full antialiased ${inter.variable} ${geistMono.variable}`}>
      <head>
        {/* Clash Display is a Fontshare face, so it cannot come through
            next/font/google. Preconnect first so the stylesheet round trip
            does not delay first paint of the headings. */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap"
        />
      </head>
      <body className="h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
