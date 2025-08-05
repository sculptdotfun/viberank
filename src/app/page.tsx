"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Upload, Github, Sparkles, TrendingUp } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import FileUpload from "@/components/FileUpload";
import Leaderboard from "@/components/Leaderboard";
import UpdatesModal from "@/components/UpdatesModal";
import { formatNumber, formatLargeNumber } from "@/lib/utils";

export default function Home() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const stats = useQuery(api.stats.getGlobalStats);

  return (
    <div className="min-h-screen bg-background">
      {/* Sleek Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-accent/20 rounded-lg blur-xl" />
                <div className="relative p-2 rounded-lg bg-gradient-to-br from-accent/10 to-transparent">
                  <Trophy className="w-5 h-5 text-accent" />
                </div>
              </div>
              <h1 className="text-xl font-semibold">viberank</h1>
            </motion.div>
            
            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                onClick={() => setShowUpdatesModal(true)}
                className="p-2 rounded-lg hover:bg-accent/10 transition-colors relative"
              >
                <Sparkles className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full" />
              </motion.button>
              
              <motion.a
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                href="https://github.com/sculptdotfun/viberank"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
              >
                <Github className="w-4 h-4" />
              </motion.a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section with Stats */}
        <div className="bg-gradient-to-b from-accent/5 via-accent/5 to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
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

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
            >
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">
                  {stats ? formatLargeNumber(stats.totalUsers) : "—"}
                </p>
                <p className="text-xs sm:text-sm text-muted">Active Users</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">
                  ${stats ? formatLargeNumber(Math.round(stats.totalCost)) : "—"}
                </p>
                <p className="text-xs sm:text-sm text-muted">Total Spent</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <p className="text-2xl sm:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">
                  {stats ? formatNumber(stats.totalTokens) : "—"}
                </p>
                <p className="text-xs sm:text-sm text-muted">Tokens Used</p>
              </div>
              
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 text-accent" />
                  <p className="text-2xl sm:text-3xl font-bold text-accent">
                    ${stats ? formatLargeNumber(Math.round(stats.topCost)) : "—"}
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-muted">Top Spender</p>
              </div>
            </motion.div>

            {/* Submit CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center px-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-accent text-white rounded-xl font-medium shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30 transition-all text-sm sm:text-base"
              >
                <Upload className="w-4 sm:w-5 h-4 sm:h-5" />
                Submit Your Stats
              </motion.button>
              
              <p className="mt-3 text-xs sm:text-sm text-muted">
                or run{" "}
                <code className="px-1.5 sm:px-2 py-0.5 bg-card rounded text-xs font-mono">npx viberank</code>
                {" "}in your terminal
              </p>
            </motion.div>
          </div>
        </div>

        {/* Leaderboard Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <Leaderboard />
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-muted">
            <div className="flex items-center gap-4">
              <span>Built with Claude Code</span>
              <a href="https://github.com/sculptdotfun/viberank" className="hover:text-foreground transition-colors">
                GitHub
              </a>
              <button
                onClick={() => setShowUpdatesModal(true)}
                className="hover:text-foreground transition-colors"
              >
                Updates
              </button>
            </div>
            <a 
              href="https://github.com/sculptdotfun/viberank#getting-started"
              className="hover:text-foreground transition-colors"
            >
              How it works
            </a>
          </div>
        </div>
      </footer>

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
              <h3 className="text-lg font-semibold">Submit Usage Data</h3>
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
              <FileUpload onSuccess={() => setShowUploadModal(false)} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Updates Modal */}
      <UpdatesModal isOpen={showUpdatesModal} onClose={() => setShowUpdatesModal(false)} />
    </div>
  );
}