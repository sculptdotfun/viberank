"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, Terminal, Copy, Check } from "lucide-react";
import FileUpload from "./FileUpload";

interface SubmitModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SubmitModal({ open, onClose }: SubmitModalProps) {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText("npx viberank-cli");
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-surface-1 border border-border rounded-lg shadow-xl max-w-sm w-full"
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <h3 className="font-medium">Submit Stats</h3>
              <button onClick={onClose} className="p-1 text-muted hover:text-foreground rounded hover:bg-surface-2">
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
