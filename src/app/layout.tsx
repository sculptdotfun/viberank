import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "viberank - claude code leaderboard",
  description: "track and compare your claude code usage. upload your cc.json file and see how you rank among developers worldwide.",
  keywords: ["claude", "claude code", "leaderboard", "ai", "usage", "ranking", "developers"],
  authors: [{ name: "viberank" }],
  creator: "viberank",
  publisher: "viberank",
  openGraph: {
    title: "viberank - claude code leaderboard",
    description: "track and compare your claude code usage",
    url: "https://viberank.com",
    siteName: "viberank",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "viberank - claude code leaderboard",
    description: "track and compare your claude code usage",
    creator: "@viberank",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  metadataBase: new URL("https://viberank.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
