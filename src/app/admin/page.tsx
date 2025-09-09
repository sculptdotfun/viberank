"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

// Add your admin GitHub usernames here
const ADMIN_USERS = ["nikshepsvn"];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  
  const flaggedSubmissions = useQuery(api.submissions.getFlaggedSubmissions);
  const updateFlagStatus = useMutation(api.submissions.updateFlagStatus);

  // Check if user is admin
  const isAdmin = session?.user?.username && ADMIN_USERS.includes(session.user.username);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted">You must be an admin to view this page.</p>
          <Link href="/" className="text-accent hover:underline">
            Return to homepage
          </Link>
        </div>
      </div>
    );
  }

  const handleUnflag = async (submissionId: string) => {
    await updateFlagStatus({
      submissionId: submissionId as any,
      flagged: false,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar 
        onUploadClick={() => {}}
        onUpdatesClick={() => {}}
      />
      <div className="max-w-7xl mx-auto px-4 py-8 pt-24 md:pt-32">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted">Review and manage flagged submissions</p>
        </div>

        {flaggedSubmissions ? (
          <div className="space-y-6">
            <div className="bg-card/50 rounded-lg p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">
                  Flagged Submissions ({flaggedSubmissions.length})
                </h2>
              </div>
              <p className="text-sm text-muted">
                These submissions have been automatically flagged for suspicious patterns.
              </p>
            </div>

            {flaggedSubmissions.length === 0 ? (
              <div className="bg-card/30 rounded-lg p-8 text-center border border-border/50">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg">No flagged submissions!</p>
                <p className="text-muted mt-2">All submissions look legitimate.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedSubmissions.map((submission) => (
                  <div
                    key={submission._id}
                    className="bg-card/30 rounded-lg p-6 border border-border/50 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">
                            {submission.githubUsername || submission.username}
                          </h3>
                          <Link
                            href={`/profile/${encodeURIComponent(submission.githubUsername || submission.username)}`}
                            className="text-accent hover:underline flex items-center gap-1"
                          >
                            View Profile
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted">
                          <span>Source: {submission.source || "unknown"}</span>
                          <span>•</span>
                          <span>
                            Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnflag(submission._id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Unflag
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted mb-1">Total Cost</p>
                        <p className="font-mono font-semibold">
                          ${formatCurrency(submission.totalCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted mb-1">Total Tokens</p>
                        <p className="font-mono">{formatNumber(submission.totalTokens)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted mb-1">Date Range</p>
                        <p className="text-sm">
                          {submission.dateRange.start} to {submission.dateRange.end}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted mb-1">Daily Average</p>
                        <p className="font-mono">
                          ${formatCurrency(
                            submission.totalCost / submission.dailyBreakdown.length
                          )}
                        </p>
                      </div>
                    </div>

                    {submission.flagReasons && submission.flagReasons.length > 0 && (
                      <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          Flag Reasons
                        </h4>
                        <ul className="space-y-1">
                          {submission.flagReasons.map((reason, index) => (
                            <li key={index} className="text-sm text-yellow-200">
                              • {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        setSelectedSubmission(
                          selectedSubmission === submission._id ? null : submission._id
                        )
                      }
                      className="mt-4 text-sm text-accent hover:underline"
                    >
                      {selectedSubmission === submission._id
                        ? "Hide details"
                        : "Show daily breakdown"}
                    </button>

                    {selectedSubmission === submission._id && (
                      <div className="mt-4 space-y-2">
                        <h4 className="font-semibold mb-2">Daily Breakdown</h4>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {submission.dailyBreakdown.map((day) => (
                            <div
                              key={day.date}
                              className="bg-background/50 rounded p-3 text-sm grid grid-cols-3 gap-2"
                            >
                              <span className="font-mono">{day.date}</span>
                              <span className="text-right">
                                ${formatCurrency(day.totalCost)}
                              </span>
                              <span className="text-right text-muted">
                                {formatNumber(day.totalTokens)} tokens
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted">Loading flagged submissions...</div>
          </div>
        )}
      </div>
    </div>
  );
}