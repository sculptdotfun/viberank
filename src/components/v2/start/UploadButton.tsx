"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// The existing web upload (sign in with GitHub, drop cc.json). Loaded on
// click: it pulls in react-dropzone.
const SubmitModal = dynamic(() => import("@/components/SubmitModal"), { ssr: false });

export default function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center h-9 px-3.5 rounded-md border border-line-2 text-[13px] font-medium text-ink hover:bg-raised"
      >
        Upload cc.json
      </button>
      {open && <SubmitModal open onClose={() => setOpen(false)} />}
    </>
  );
}
