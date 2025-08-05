"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitCommit, Clock, ExternalLink, Sparkles, TrendingUp } from "lucide-react";

interface Commit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
  html_url: string;
}

interface UpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatesModal({ isOpen, onClose }: UpdatesModalProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchRecentCommits();
    }
  }, [isOpen]);

  const fetchRecentCommits = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/sculptdotfun/viberank/commits?per_page=10"
      );
      if (response.ok) {
        const data = await response.json();
        setCommits(data);
      }
    } catch (error) {
      console.error("Failed to fetch commits:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} minutes ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }
  };

  const formatCommitMessage = (message: string) => {
    // Extract the first line and clean it up
    const firstLine = message.split('\n')[0];
    
    // Extract emoji if present
    const emojiMatch = firstLine.match(/^([\u{1F300}-\u{1F6FF}]|[\u{2600}-\u{26FF}])/u);
    const emoji = emojiMatch ? emojiMatch[0] : null;
    const cleanMessage = emoji ? firstLine.replace(emoji, '').trim() : firstLine;
    
    // Extract type if present (feat:, fix:, etc.)
    const typeMatch = cleanMessage.match(/^(\w+):\s*/);
    const type = typeMatch ? typeMatch[1] : null;
    const finalMessage = type ? cleanMessage.replace(/^\w+:\s*/, '') : cleanMessage;
    
    return { emoji, type, message: finalMessage };
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'feat': return 'text-green-500';
      case 'fix': return 'text-blue-500';
      case 'docs': return 'text-purple-500';
      case 'style': return 'text-pink-500';
      case 'refactor': return 'text-orange-500';
      default: return 'text-muted';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="border-b border-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Recent Updates</h3>
                  <p className="text-sm text-muted">Latest improvements to viberank</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-muted">Loading updates...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {commits.map((commit) => {
                    const { emoji, type, message } = formatCommitMessage(commit.commit.message);
                    return (
                      <motion.div
                        key={commit.sha}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group relative border border-border rounded-lg p-4 hover:border-accent/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {emoji ? (
                              <span className="text-lg">{emoji}</span>
                            ) : (
                              <GitCommit className="w-5 h-5 text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {type && (
                                <span className={`text-xs font-medium ${getTypeColor(type)}`}>
                                  {type}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground line-clamp-1">
                                {message}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(commit.commit.author.date)}
                              </span>
                              <a
                                href={commit.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-accent transition-colors"
                              >
                                View commit
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {commits.length === 0 && (
                    <div className="text-center py-12 text-muted">
                      <p>No recent updates found</p>
                    </div>
                  )}
                  
                  {commits.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border">
                      <a
                        href="https://github.com/sculptdotfun/viberank/commits/main"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm text-muted hover:text-accent transition-colors"
                      >
                        View all commits on GitHub
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Features section */}
            <div className="border-t border-border px-6 py-4 bg-accent/5">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-muted">
                  viberank is continuously improving with new features and enhancements
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}