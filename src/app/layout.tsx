import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Viberank - Claude Code, Codex & AI Coding Usage Leaderboard | Track AI Dev Stats",
  description: "The public AI token leaderboard for vibe coding. Track Claude Code, OpenAI Codex, Gemini CLI and more with ccusage data — see real spend, tokens burned, and how your tokenmaxxing ranks against 1,000+ developers.",
  keywords: ["claude", "claude code", "claude code leaderboard", "anthropic", "codex", "codex leaderboard", "codex token usage", "openai codex", "gemini cli", "github copilot", "opencode", "ccusage", "ai coding", "ai coding leaderboard", "ai token leaderboard", "token leaderboard", "tokenmaxxing", "token maxxing", "leaderboard", "developer stats", "code usage", "token usage tracker", "ai development", "developer ranking", "cc.json", "npx viberank-cli", "vibe coding", "vibe coding leaderboard", "ai pair programming"],
  authors: [{ name: "Viberank Team" }],
  creator: "Viberank",
  publisher: "Viberank",
  openGraph: {
    title: "Viberank - Claude Code, Codex & AI Coding Usage Leaderboard",
    description: "Track and compare your AI coding usage — Claude Code, Codex, Gemini CLI and more — with developers worldwide. View detailed analytics and climb the AI development leaderboard.",
    url: "https://www.viberank.app",
    siteName: "Viberank",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Viberank - Claude Code, Codex & AI Coding Usage Leaderboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viberank - Claude Code, Codex & AI Coding Usage Leaderboard",
    description: "Track and compare your AI coding usage — Claude Code, Codex, Gemini CLI and more — with developers worldwide. Join the AI development leaderboard today!",
    images: ["/api/og"],
    creator: "@viberank",
    site: "@viberank",
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
  metadataBase: new URL("https://www.viberank.app"),
  alternates: {
    canonical: "https://www.viberank.app",
  },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  // Parallel slot for the intercepted profile sheet (see app/@modal).
  modal: React.ReactNode;
}>) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Viberank",
      "description": "The public AI token leaderboard for vibe coding — track Claude Code, OpenAI Codex, Gemini CLI and more with real ccusage data and see how your tokenmaxxing ranks.",
      "url": "https://www.viberank.app",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "author": {
        "@type": "Organization",
        "name": "Viberank",
        "url": "https://www.viberank.app"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Viberank",
      "url": "https://www.viberank.app",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.viberank.app/profile/{search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ];

  return (
    <html lang="en">
      <head>
        {/* Avatars come from the GitHub CDN on every page — start the TLS
            handshake before the first <img> is discovered. */}
        <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
          {modal}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
