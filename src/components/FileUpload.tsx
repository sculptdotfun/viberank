"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, Github, Share2, Copy, Check, ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { track } from "@vercel/analytics";
import { signInAndReopenSubmit } from "@/lib/submit-modal";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useSubmit } from "@/lib/data/hooks/useSubmissions";
import { autosubmitCommandCopied } from "@/lib/analytics";
import { AUTOSUBMIT_COMMAND, CCUSAGE_EXPORT_COMMAND } from "@/lib/commands";
import type { ModelBreakdown, SubmitResponse } from "@/lib/data/types";

interface CCData {
  daily: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    totalCost: number;
    modelsUsed: string[];
    modelBreakdowns?: ModelBreakdown[];
  }>;
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number;
    totalTokens: number;
  };
}

/** Path part of the profile URL the API returns, so links stay on this host. */
function profilePath(result: SubmitResponse, fallbackUsername: string): string {
  try {
    if (result.profileUrl) return new URL(result.profileUrl).pathname;
  } catch {
    // fall through to the session's handle
  }
  return `/profile/${encodeURIComponent(fallbackUsername)}`;
}

function SubmitSuccess({ result, username }: { result: SubmitResponse; username: string }) {
  const [copied, setCopied] = useState(false);
  const standing = result.standing && result.standing.totalDevelopers > 0 ? result.standing : null;
  const shareUrl = result.profileUrl ?? `https://www.viberank.app${profilePath(result, username)}`;

  const shareToX = () => {
    const text = standing
      ? `I'm ranked #${standing.rank} of ${standing.totalDevelopers.toLocaleString("en-US")} developers on viberank 🏆\n\n${standing.tier} tier · top ${standing.topPercent}% by AI coding spend\n\nWhere do you rank?`
      : "My AI coding usage is on viberank 🏆\n\nWhere do you rank?";
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyAutosubmit = () => {
    navigator.clipboard.writeText(AUTOSUBMIT_COMMAND);
    autosubmitCommandCopied("upload_success");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 bg-surface-1 rounded-lg border border-border"
      role="status"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-green-400">
        <CheckCircle className="w-4 h-4" />
        Submitted
      </div>
      <p className="text-sm text-foreground mt-2">
        {standing ? (
          <>
            <span className="font-mono font-bold text-accent">#{standing.rank}</span> of{" "}
            {standing.totalDevelopers.toLocaleString("en-US")} developers · top {standing.topPercent}% ·{" "}
            {standing.tier} tier
          </>
        ) : (
          "You're on the board."
        )}
      </p>

      <div className="flex gap-2 mt-3">
        <Link
          href={profilePath(result, username)}
          className="flex-1 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors flex items-center justify-center gap-1.5"
        >
          View your profile
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={shareToX}
          className="px-3 py-2 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors flex items-center gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share on X
        </button>
      </div>

      {/* A one-off upload freezes the profile on today. */}
      <p className="text-[11px] text-muted mt-3 leading-relaxed">Keep it up to date daily:</p>
      <button
        onClick={copyAutosubmit}
        aria-label={`Copy ${AUTOSUBMIT_COMMAND}`}
        className="w-full flex items-center justify-between gap-2 bg-background rounded-md px-3 py-2 mt-1.5 border border-border hover:border-accent/50 transition-colors text-left"
      >
        <code className="text-xs font-mono text-accent min-w-0">{AUTOSUBMIT_COMMAND}</code>
        {copied ? <Check className="w-4 h-4 text-success flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-muted flex-shrink-0" />}
      </button>
    </motion.div>
  );
}

export default function FileUpload() {
  const { data: session, status } = useSession();
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedData, setParsedData] = useState<CCData | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const { mutate: submit } = useSubmit();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadState("loading");
    setErrorMessage("");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as CCData;

        if (!data.daily || !data.totals) {
          throw new Error("Invalid cc.json format");
        }

        setParsedData(data);
        setUploadState("idle");
      } catch {
        setErrorMessage("Invalid file format. Please upload a valid cc.json file.");
        setUploadState("error");
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/json': ['.json'] },
    maxFiles: 1
  });

  const username = session?.user?.username;

  const handleSubmit = async () => {
    if (!parsedData || !username) return;

    setUploadState("loading");
    try {
      const response = await submit({
        username,
        githubUsername: username,
        githubName: session?.user?.name || undefined,
        githubAvatar: session?.user?.image || undefined,
        source: "oauth",
        verified: true,
        ccData: parsedData,
      });
      setResult(response);
      setUploadState("success");
      track("submit_completed", { source: "web" });
      setParsedData(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit");
      setUploadState("error");
    }
  };

  if (uploadState === "success" && result && username) {
    return <SubmitSuccess result={result} username={username} />;
  }

  const howToMakeFile = (
    <p className="text-[11px] text-muted mt-2 leading-relaxed">
      Make the file with <code className="font-mono text-foreground/80 break-words">{CCUSAGE_EXPORT_COMMAND}</code>
    </p>
  );

  // Uploads are filed under your GitHub account, so sign-in comes before the
  // file rather than after it (see signInAndReopenSubmit).
  if (status === "loading") {
    return <div className="h-[104px] rounded-lg border border-dashed border-border animate-pulse" aria-hidden />;
  }
  if (!username) {
    return (
      <div>
        <div className="border border-dashed border-border rounded-lg p-5 text-center">
          <FileJson className="w-7 h-7 mx-auto mb-2 text-muted" />
          <p className="text-xs text-muted mb-3">Uploads are filed under your GitHub account.</p>
          <button
            onClick={signInAndReopenSubmit}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium border border-border rounded-md hover:bg-surface-2 transition-colors"
          >
            <Github className="w-4 h-4" />
            Sign in with GitHub to upload
          </button>
        </div>
        {howToMakeFile}
      </div>
    );
  }

  return (
    <div>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-muted"
        }`}
      >
        <input {...getInputProps()} />
        <FileJson className="w-8 h-8 mx-auto mb-2 text-muted" />
        <p className="text-sm text-foreground">
          {isDragActive ? "Drop cc.json here" : "Drop cc.json or click to browse"}
        </p>
      </div>
      {howToMakeFile}

      {/* Preview */}
      <AnimatePresence>
        {parsedData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 bg-surface-1 rounded-lg border border-border"
          >
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Cost</span>
                <span className="font-mono">${formatCurrency(parsedData.totals.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tokens</span>
                <span className="font-mono">{formatNumber(parsedData.totals.totalTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Days</span>
                <span className="font-mono">{parsedData.daily.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Range</span>
                <span className="font-mono text-[10px]">
                  {parsedData.daily[0]?.date} → {parsedData.daily[parsedData.daily.length - 1]?.date}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSubmit}
                disabled={uploadState === "loading"}
                className="flex-1 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {uploadState === "loading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Submit
              </button>
              <button
                onClick={() => { setParsedData(null); setUploadState("idle"); }}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status */}
      <AnimatePresence>
        {uploadState === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-3 p-2.5 bg-red-500/10 text-red-400 rounded-lg flex items-start gap-2 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
