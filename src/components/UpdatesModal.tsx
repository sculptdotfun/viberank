"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitCommit, Clock, ExternalLink, Sparkles } from "lucide-react";

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
        "https://api.github.com/repos/sculptdotfun/viberank/commits?per_page=8"
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
        return `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }
  };

  const formatCommitMessage = (message: string) => {
    const firstLine = message.split('\n')[0];
    const typeMatch = firstLine.match(/^(\w+):\s*/);
    const type = typeMatch ? typeMatch[1] : null;
    const cleanMessage = type ? firstLine.replace(/^\w+:\s*/, '') : firstLine;
    return { type, message: cleanMessage };
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'feat': return 'text-green-400';
      case 'fix': return 'text-blue-400';
      case 'docs': return 'text-purple-400';
      case 'refactor': return 'text-accent';
      case 'chore': return 'text-muted';
      default: return 'text-muted';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-card border border-border rounded-lg shadow-xl max-w-md w-full max-h-[70vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="font-medium">Recent Updates</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-muted hover:text-foreground rounded hover:bg-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(70vh-7rem)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {commits.map((commit) => {
                    const { type, message } = formatCommitMessage(commit.commit.message);
                    return (
                      <div
                        key={commit.sha}
                        className="px-4 py-3 hover:bg-surface-1 transition-colors"
                      >
                        <div className="flex items-start gap-2.5">
                          <GitCommit className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {type && (
                                <span className={`text-[10px] font-medium ${getTypeColor(type)}`}>
                                  {type}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground line-clamp-2 mb-1">
                              {message}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-muted">
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
                                View
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border bg-surface-1">
              <a
                href="https://github.com/sculptdotfun/viberank/commits/main"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
              >
                View all on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
