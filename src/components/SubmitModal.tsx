"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Terminal, Copy, Check } from "lucide-react";
import { track } from "@vercel/analytics";
import FileUpload from "./FileUpload";

interface SubmitModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SubmitModal({ open, onClose }: SubmitModalProps) {
  const [copied, setCopied] = useState(false);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const copyCommand = () => {
    navigator.clipboard.writeText("npx viberank-cli");
    track("cli_command_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Submit stats"
            className="relative bg-surface-1 border border-border border-b-0 sm:border-b rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-sm max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-border sticky top-0 bg-surface-1">
              <h3 className="font-medium">Submit Stats</h3>
              <button onClick={onClose} aria-label="Close" className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-surface-2 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* CLI option */}
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Terminal className="w-4 h-4 text-accent" />
                    <span className="font-medium">CLI</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded">Recommended</span>
                </div>
                <button
                  onClick={copyCommand}
                  className="w-full flex items-center justify-between gap-2 bg-background rounded-md px-3 py-2 border border-border hover:border-accent/50 transition-colors"
                >
                  <code className="text-sm font-mono text-accent">npx viberank-cli</code>
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted" />}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Upload option */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-sm">
                  <Upload className="w-4 h-4 text-muted" />
                  <span className="font-medium">Upload cc.json</span>
                </div>
                <FileUpload onSuccess={onClose} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
