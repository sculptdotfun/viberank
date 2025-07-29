"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Code2, Github, BarChart3 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import FileUpload from "@/components/FileUpload";
import Leaderboard from "@/components/Leaderboard";
import { formatNumber, formatLargeNumber } from "@/lib/utils";

export default function Home() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const stats = useQuery(api.stats.getGlobalStats);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Modern Header with Stats */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo and Title */}
            <motion.div 
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div 
                className="relative group"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-accent/10 rounded-xl blur-lg group-hover:blur-xl transition-all duration-300" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 group-hover:border-accent/30 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 12L3 21" stroke="#dc8850" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M9 8L9 21" stroke="#e07b39" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M15 4L15 21" stroke="#f39c52" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M21 14L21 21" stroke="#dc8850" strokeWidth="2.5" strokeLinecap="round"/>
                    <circle cx="3" cy="9" r="2.5" fill="#dc8850"/>
                    <circle cx="9" cy="5" r="2.5" fill="#e07b39"/>
                    <circle cx="15" cy="2" r="2.5" fill="#f39c52"/>
                    <circle cx="21" cy="11" r="2.5" fill="#dc8850"/>
                  </svg>
                </div>
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                  viberank
                </h1>
                <p className="text-sm text-muted hidden sm:block font-medium">
                  Claude Code Usage Leaderboard
                </p>
              </div>
            </motion.div>
            
            {/* Stats Bar */}
            <div className="flex items-center gap-8">
              <div className="hidden lg:flex items-center gap-6">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-center px-3"
                >
                  <p className="text-2xl font-bold tabular-nums">
                    {stats ? formatLargeNumber(stats.totalUsers) : "—"}
                  </p>
                  <p className="text-xs text-muted font-medium">users</p>
                </motion.div>
                
                <div className="h-8 w-px bg-border" />
                
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="text-center px-3"
                >
                  <p className="text-2xl font-bold tabular-nums">
                    ${stats ? formatLargeNumber(Math.round(stats.totalCost)) : "—"}
                  </p>
                  <p className="text-xs text-muted font-medium">total spent</p>
                </motion.div>
                
                <div className="h-8 w-px bg-border" />
                
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="text-center px-3"
                >
                  <p className="text-2xl font-bold tabular-nums">
                    {stats ? formatNumber(stats.totalTokens) : "—"}
                  </p>
                  <p className="text-xs text-muted font-medium">tokens</p>
                </motion.div>
                
                <div className="h-8 w-px bg-border" />
                
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="text-center px-3"
                >
                  <p className="text-2xl font-bold text-accent tabular-nums">
                    ${stats ? formatLargeNumber(Math.round(stats.topCost)) : "—"}
                  </p>
                  <p className="text-xs text-muted font-medium">top spend</p>
                </motion.div>
              </div>
              
              {/* Mobile Stats */}
              <div className="flex lg:hidden items-center gap-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-lg tabular-nums">{stats ? formatLargeNumber(stats.totalUsers) : 0}</p>
                  <p className="text-xs text-muted">users</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="font-bold text-lg tabular-nums">${stats ? formatLargeNumber(Math.round(stats.totalCost)) : 0}</p>
                  <p className="text-xs text-muted">total</p>
                </div>
              </div>
              
              {/* GitHub Link */}
              <motion.a
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.5 }}
                href="https://github.com/sculptdotfun/viberank"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl hover:bg-accent/10 transition-colors"
              >
                <Github className="w-5 h-5" />
              </motion.a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header with Submit Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-1">Global Usage Leaderboard</h2>
              <p className="text-base text-muted">See who's pushing the limits of AI-powered development</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUploadModal(true)}
              className="group relative px-5 py-2.5 bg-gradient-to-r from-accent to-accent/80 text-white rounded-xl font-medium shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all duration-200 flex items-center gap-2.5"
            >
              <Upload className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              Submit Usage
            </motion.button>
          </div>

          {/* Leaderboard Content */}
          <Leaderboard />
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowUploadModal(false)}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
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
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <FileUpload onSuccess={() => setShowUploadModal(false)} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Built with Claude Code
            </p>
            <a
              href="https://github.com/sculptdotfun/viberank"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}