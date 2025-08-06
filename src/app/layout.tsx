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
  title: "Viberank - Claude Code Usage Leaderboard | Track AI Development Stats",
  description: "Track and compare Claude Code usage across developers. Upload your cc.json file, view detailed analytics, and see how you rank in the global AI-powered development community.",
  keywords: ["claude", "claude code", "anthropic", "ai coding", "leaderboard", "developer stats", "code usage", "ai development", "claude analytics", "developer ranking", "cc.json", "npx viberank"],
  authors: [{ name: "Viberank Team" }],
  creator: "Viberank",
  publisher: "Viberank",
  openGraph: {
    title: "Viberank - Claude Code Usage Leaderboard",
    description: "Track and compare your Claude Code usage with developers worldwide. View detailed analytics and climb the AI development leaderboard.",
    url: "https://viberank.com",
    siteName: "Viberank",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viberank - Claude Code Usage Leaderboard",
    description: "Track and compare your Claude Code usage with developers worldwide. Join the AI development leaderboard today!",
    creator: "@viberank",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon",
  },
  metadataBase: new URL("https://viberank.com"),
  alternates: {
    canonical: "https://viberank.com",
  },
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
