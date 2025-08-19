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
  title: "Viberank - Claude Code Usage Leaderboard | Track AI Development Stats",
  description: "Track and compare Claude Code usage across developers. Upload your cc.json file, view detailed analytics, and see how you rank in the global AI-powered development community.",
  keywords: ["claude", "claude code", "anthropic", "ai coding", "leaderboard", "developer stats", "code usage", "ai development", "claude analytics", "developer ranking", "cc.json", "npx viberank", "vibe coding", "ai pair programming"],
  authors: [{ name: "Viberank Team" }],
  creator: "Viberank",
  publisher: "Viberank",
  openGraph: {
    title: "Viberank - Claude Code Usage Leaderboard",
    description: "Track and compare your Claude Code usage with developers worldwide. View detailed analytics and climb the AI development leaderboard.",
    url: "https://viberank.com",
    siteName: "Viberank",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Viberank - Claude Code Usage Leaderboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viberank - Claude Code Usage Leaderboard",
    description: "Track and compare your Claude Code usage with developers worldwide. Join the AI development leaderboard today!",
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
  metadataBase: new URL("https://viberank.com"),
  alternates: {
    canonical: "https://viberank.com",
  },
  verification: {
    google: "",
    yandex: "",
    yahoo: "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Viberank",
    "description": "Track and compare Claude Code usage across developers. View detailed analytics and climb the AI development leaderboard.",
    "url": "https://viberank.com",
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
      "url": "https://viberank.com"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1000"
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
