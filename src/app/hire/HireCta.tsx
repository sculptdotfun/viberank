"use client";

import { track } from "@vercel/analytics";
import { Mail } from "lucide-react";

const MAILTO =
  "mailto:nikshepsvn@gmail.com?subject=" +
  encodeURIComponent("Job post on viberank /hire") +
  "&body=" +
  encodeURIComponent(
    "Company:\nRole + link:\nRemote/location:\nComp range:\n\nWe'll get back within 24h with details."
  );

// Company-facing CTA. Mailto for the MVP — swap for a form/Stripe once
// there's demand worth automating.
export default function HireCta() {
  return (
    <a
      href={MAILTO}
      onClick={() => track("hire_cta_click")}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
    >
      <Mail className="w-4 h-4" />
      Post a job — reach these engineers
    </a>
  );
}
