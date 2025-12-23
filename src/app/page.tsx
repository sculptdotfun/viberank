"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Merge, X } from "lucide-react";
import { useQuery } from "@/hooks/useApi";
import Leaderboard from "@/components/Leaderboard";
import UpdatesModal from "@/components/UpdatesModal";
import { formatNumber, formatLargeNumber } from "@/lib/utils";

export default function Home() {
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [showMergeBanner, setShowMergeBanner] = useState(true);
  const [merging, setMerging] = useState(false);
  
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const stats = useQuery<any>("/api/stats", {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  // TODO: Implement claim and merge functionality with PostgreSQL
  const claimStatus = null;
  const claimAndMergeMutation = null;
  
  const handleClaimAndMerge = async () => {
    // This functionality is disabled without authentication
    return;
  };

  return (
    <div className="min-h-screen bg-background">

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
      <main className={`flex-1 ${showMergeBanner && claimStatus?.actionNeeded ? 'pt-20' : 'pt-8'} transition-all`}>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <Leaderboard 
            dateFrom={dateFrom} 
            dateTo={dateTo} 
            setDateFrom={setDateFrom} 
            setDateTo={setDateTo} 
          />
        </div>
        </div>
      </main>

      {/* Updates Modal */}
      <UpdatesModal isOpen={showUpdatesModal} onClose={() => setShowUpdatesModal(false)} />
    </div>
  );
}