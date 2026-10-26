import type { Metadata } from "next";

// The admin page is a client component, so it can't export metadata itself,
// and it inherited the homepage's title and canonical: crawlers saw a second
// copy of the homepage at /admin. It is noindex, and its own page.
export const metadata: Metadata = {
  title: "Admin | Viberank",
  description: "Maintainer review tools for Viberank submissions.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
