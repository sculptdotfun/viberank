import { notFound } from "next/navigation";
import PreviewClient from "./PreviewClient";

// Dev-only: the v2 site rendered from fixtures, for screenshots before the
// weekly data layer lands. 404 in production.
//   /v2-preview?view=home|records|fleets|tool&me=none|near|far
export const dynamic = "force-dynamic";

export default async function V2Preview({ searchParams }: { searchParams: Promise<{ view?: string; me?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view = "home", me = "near" } = await searchParams;
  return <PreviewClient view={view} meMode={me} />;
}
