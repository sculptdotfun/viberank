"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Github, Merge, X, Terminal, Copy, Check } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import Leaderboard from "@/components/Leaderboard";
import UpdatesModal from "@/components/UpdatesModal";
import NavBar from "@/components/NavBar";
import { useSession } from "next-auth/react";
import { useCheckClaimableSubmissions, useClaimAndMergeSubmissions } from "@/lib/data/hooks/useSubmissions";

export default function Home() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showMergeBanner, setShowMergeBanner] = useState(true);
  const [merging, setMerging] = useState(false);

  const { data: session } = useSession();
  const { data: claimStatus } = useCheckClaimableSubmissions(
    session?.user?.username || undefined
  );
  const { mutate: claimAndMerge } = useClaimAndMergeSubmissions();

  const copyCommand = () => {
    navigator.clipboard.writeText("npx viberank");
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const handleClaimAndMerge = async () => {
    if (!session?.user?.username) return;

    setMerging(true);
    try {
      await claimAndMerge(session.user.username);
      setShowMergeBanner(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to process:", error);
      alert("Failed to process submissions. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <NavBar
        onUploadClick={() => setShowUploadModal(true)}
        onUpdatesClick={() => setShowUpdatesModal(true)}
      />

      {/* Claim/Merge Banner */}
      <AnimatePresence>
        {showMergeBanner && claimStatus?.actionNeeded && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 md:top-20 left-0 right-0 z-40 px-4"
          >
            <div className="max-w-4xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Merge className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{claimStatus.actionText}</p>
                    <p className="text-xs text-muted">
                      {claimStatus.actionNeeded === "claim"
                        ? "Verify your submission"
                        : `Merge ${claimStatus.totalSubmissions} submissions`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClaimAndMerge}
                    disabled={merging}
                    className="px-3 py-1.5 bg-accent text-white text-sm rounded font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {merging ? "..." : claimStatus.actionNeeded === "claim" ? "Verify" : "Merge"}
                  </button>
                  <button
                    onClick={() => setShowMergeBanner(false)}
                    className="p-1 hover:bg-border rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`${showMergeBanner && claimStatus?.actionNeeded ? 'pt-28 md:pt-32' : 'pt-20 md:pt-24'}`}>
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Claude Code Leaderboard</h1>
              <p className="text-muted text-sm sm:text-base">Track usage and compare with other developers</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                <Terminal className="w-4 h-4 text-muted" />
                <code className="font-mono text-accent">npx viberank</code>
                <button
                  onClick={copyCommand}
                  className="p-1 hover:bg-border rounded transition-colors"
                >
                  {copiedToClipboard ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
          <Leaderboard />
        </div>

        {/* Footer */}
        <footer className="border-t border-border py-4 mt-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between text-sm text-muted">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75"/>
                  <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor"/>
                </svg>
                <span className="font-medium text-foreground">viberank</span>
              </div>
              <a
                href="https://github.com/sculptdotfun/viberank"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">Source</span>
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowUploadModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative bg-card border border-border rounded-xl shadow-lg max-w-md w-full max-h-[80vh] overflow-hidden"
            >
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold">Submit Stats</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 hover:bg-border rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto">
                {/* CLI Option */}
                <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-accent" />
                    <span className="font-medium text-sm">Terminal</span>
                    <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-xs">Recommended</span>
                  </div>
                  <div className="flex items-center gap-2 bg-background rounded p-2 border border-border">
                    <code className="text-sm font-mono text-accent flex-1">npx viberank</code>
                    <button
                      onClick={copyCommand}
                      className="p-1 hover:bg-border rounded transition-colors"
                    >
                      {copiedToClipboard ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Manual Upload */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Upload className="w-4 h-4 text-muted" />
                    <span className="font-medium text-sm">Manual Upload</span>
                  </div>
                  <FileUpload onSuccess={() => setShowUploadModal(false)} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Updates Modal */}
      <UpdatesModal isOpen={showUpdatesModal} onClose={() => setShowUpdatesModal(false)} />
    </div>
  );
}
