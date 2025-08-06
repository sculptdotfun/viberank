"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Upload, Github, Sparkles, TrendingUp, Merge, X } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import FileUpload from "@/components/FileUpload";
import Leaderboard from "@/components/Leaderboard";
import UpdatesModal from "@/components/UpdatesModal";
import NavBar from "@/components/NavBar";
import { formatNumber, formatLargeNumber } from "@/lib/utils";
import { useSession } from "next-auth/react";

export default function Home() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showMergeBanner, setShowMergeBanner] = useState(true);
  const [merging, setMerging] = useState(false);
  
  const { data: session } = useSession();
  const stats = useQuery(api.stats.getGlobalStats);
  const claimStatus = useQuery(
    api.submissions.checkClaimableSubmissions, 
    session?.user?.username ? { githubUsername: session.user.username } : "skip"
  );
  const claimAndMergeMutation = useMutation(api.submissions.claimAndMergeSubmissions);

  const copyCommand = () => {
    navigator.clipboard.writeText("npx viberank");
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };
  
  const handleClaimAndMerge = async () => {
    if (!session?.user?.username) return;
    
    setMerging(true);
    try {
      const result = await claimAndMergeMutation({ githubUsername: session.user.username });
      setShowMergeBanner(false);
      // Refresh the page to show updated data
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
            className="fixed top-14 md:top-20 left-0 right-0 z-40"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 sm:p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Merge className="w-5 h-5 text-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {claimStatus.actionText}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {claimStatus.actionNeeded === "claim" 
                        ? "Add verification badge to your submission"
                        : `Combine your ${claimStatus.totalSubmissions} submissions into one verified entry`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClaimAndMerge}
                    disabled={merging}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {merging ? "Processing..." : claimStatus.actionNeeded === "claim" ? "Verify" : "Merge"}
                  </button>
                  <button
                    onClick={() => setShowMergeBanner(false)}
                    className="p-1.5 hover:bg-accent/10 rounded-lg transition-colors"
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
      <main className={`flex-1 ${showMergeBanner && claimStatus?.actionNeeded ? 'pt-28 md:pt-32' : 'pt-14 md:pt-0'} transition-all`}>
        {/* Hero Section */}
        <div className="relative bg-gradient-to-b from-accent/5 via-transparent to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-20 md:pt-32 pb-6 sm:pb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Claude Code Leaderboard
              </h2>
              <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto px-4">
                Track and compare AI-powered development usage across the community
              </p>
            </motion.div>

            {/* Compact Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center justify-center gap-6 sm:gap-8 text-center flex-wrap mb-12"
            >
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{stats?.totalSubmissions || 0}</p>
                <p className="text-xs sm:text-sm text-muted">Developers</p>
              </div>
              <div className="w-px h-12 bg-border/50 hidden sm:block" />
              <div>
                <p className="text-2xl sm:text-3xl font-bold">
                  {stats ? formatNumber(stats.totalTokens) : "0"}
                </p>
                <p className="text-xs sm:text-sm text-muted">Total Tokens</p>
              </div>
              <div className="w-px h-12 bg-border/50 hidden sm:block" />
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-accent">
                  ${stats ? formatLargeNumber(Math.round(stats.totalCost)) : "0"}
                </p>
                <p className="text-xs sm:text-sm text-muted">Total Spent</p>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <Leaderboard />
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-background border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Submit Your Stats</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
              {/* CLI Option */}
              <div className="mb-6 p-6 bg-card/50 rounded-xl border border-border/50">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Option 1: Terminal (Recommended)
                </h4>
                <p className="text-sm text-muted mb-4">Quick submit via command line</p>
                <div className="flex items-center gap-3 bg-background rounded-lg p-3 border border-border/50">
                  <code className="text-sm font-mono text-accent">npx viberank</code>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={copyCommand}
                    className="ml-auto p-1.5 hover:bg-accent/10 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedToClipboard ? (
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Manual Upload Option */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Option 2: Manual Upload
                </h4>
                <FileUpload onSuccess={() => setShowUploadModal(false)} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Updates Modal */}
      <UpdatesModal isOpen={showUpdatesModal} onClose={() => setShowUpdatesModal(false)} />
    </div>
  );
}