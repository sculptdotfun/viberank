"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Github, Calendar, DollarSign, Zap, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatNumber, formatCurrency } from "@/lib/utils";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;
  
  const profileData = useQuery(api.submissions.getProfile, { username });

  if (profileData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-light mb-4">Profile not found</h1>
          <p className="text-muted mb-8">No profile found for @{username}</p>
          <Link href="/" className="text-accent hover:underline">
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const latestSubmission = profileData.submissions[0];
  const totalCost = profileData.submissions.reduce((sum, sub) => sum + sub.totalCost, 0);
  const totalTokens = profileData.submissions.reduce((sum, sub) => sum + sub.totalTokens, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to leaderboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Header */}
          <div className="bg-card rounded-lg p-6 mb-6">
            <div className="flex items-start gap-6">
              {profileData.avatar && (
                <img
                  src={profileData.avatar}
                  alt={profileData.githubName || username}
                  className="w-20 h-20 rounded-full"
                />
              )}
              <div className="flex-1">
                <h1 className="text-2xl font-medium mb-2">
                  {profileData.githubName || username}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <a
                    href={`https://github.com/${profileData.githubUsername || username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    @{profileData.githubUsername || username}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span>
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Joined {new Date(profileData.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <p className="text-2xl font-mono font-medium">{profileData.totalSubmissions}</p>
                <p className="text-sm text-muted">Submissions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-mono font-medium">${formatCurrency(totalCost)}</p>
                <p className="text-sm text-muted">Total Cost</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-mono font-medium">{formatNumber(totalTokens)}</p>
                <p className="text-sm text-muted">Total Tokens</p>
              </div>
            </div>
          </div>

          {/* Submissions History */}
          <div className="bg-card rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Submission History</h2>
            <div className="space-y-4">
              {profileData.submissions.map((submission, index) => (
                <motion.div
                  key={submission._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-border rounded-md p-4 hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted mb-1">
                        {new Date(submission.submittedAt).toLocaleDateString()} • 
                        {submission.dateRange.start} to {submission.dateRange.end}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <DollarSign className="w-3 h-3 inline mr-1" />
                          ${formatCurrency(submission.totalCost)}
                        </span>
                        <span>
                          <Zap className="w-3 h-3 inline mr-1" />
                          {formatNumber(submission.totalTokens)} tokens
                        </span>
                      </div>
                    </div>
                    {submission.verified && (
                      <span className="text-xs bg-success/10 text-success px-2 py-1 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    Models: {submission.modelsUsed.join(", ")}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Latest Submission Details */}
          {latestSubmission && (
            <div className="bg-card rounded-lg p-6 mt-6">
              <h2 className="text-lg font-medium mb-4">Latest Submission Breakdown</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted">Input Tokens</p>
                  <p className="font-mono">{formatNumber(latestSubmission.inputTokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Output Tokens</p>
                  <p className="font-mono">{formatNumber(latestSubmission.outputTokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Cache Creation</p>
                  <p className="font-mono">{formatNumber(latestSubmission.cacheCreationTokens)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Cache Read</p>
                  <p className="font-mono">{formatNumber(latestSubmission.cacheReadTokens)}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}