"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, Github } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession, signIn } from "next-auth/react";
import { formatNumber, formatCurrency } from "@/lib/utils";

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
    modelBreakdowns?: any[];
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

interface FileUploadProps {
  onSuccess?: () => void;
}

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const { data: session } = useSession();
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedData, setParsedData] = useState<CCData | null>(null);
  
  const submitMutation = useMutation(api.submissions.submit);

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
        
        // Validate the structure
        if (!data.daily || !data.totals) {
          throw new Error("Invalid cc.json format. Missing 'daily' or 'totals' field.");
        }
        
        setParsedData(data);
        setUploadState("idle");
      } catch (error) {
        setErrorMessage("Invalid file format. Please upload a valid cc.json file.");
        setUploadState("error");
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    maxFiles: 1
  });

  const handleSubmit = async () => {
    if (!parsedData) return;
    
    setUploadState("loading");
    try {
      // Submit will use session if available, otherwise submit as unverified
      await submitMutation({
        username: session?.user?.username || "anonymous",
        githubUsername: session?.user?.username,
        githubName: session?.user?.name,
        githubAvatar: session?.user?.image,
        source: session ? "oauth" : "cli",
        verified: !!session,
        ccData: parsedData,
      });
      setUploadState("success");
      setParsedData(null);
      
      // Call onSuccess callback after successful submission
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit");
      setUploadState("error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Instructions */}
        <div className="mb-6 space-y-4">
          <div>
            <h4 className="font-medium mb-2">Step 1: Generate your usage file</h4>
            <p className="text-sm text-muted mb-3">
              Run this command in your terminal to generate your Claude usage statistics:
            </p>
            <div className="bg-card rounded-lg p-3 border border-border/50">
              <code className="text-sm font-mono text-accent">
                npx ccusage --json &gt; cc.json
              </code>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Step 2: Upload the generated file</h4>
            <p className="text-sm text-muted">
              Drag and drop your cc.json file below, or click to browse
            </p>
          </div>

          {/* Verification status notice */}
          {session ? (
            <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
              <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Signed in as {session.user.username || session.user?.name}</span>
                <span className="text-muted"> - Your submission will be verified</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Submitting without verification</span>
                  <span className="text-muted"> - Sign in to get verified badge</span>
                </div>
              </div>
              <button
                onClick={() => signIn("github")}
                className="text-sm px-3 py-1 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors flex items-center gap-1.5"
              >
                <Github className="w-3.5 h-3.5" />
                Sign in
              </button>
            </div>
          )}
        </div>

        {/* File Upload */}
        <div
          {...getRootProps()}
          className={`border border-dashed rounded-md p-12 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-accent bg-accent/5"
              : "border-border hover:border-muted"
          }`}
        >
          <input {...getInputProps()} />
          <FileJson className="w-10 h-10 mx-auto mb-4 text-muted" />
          <p className="text-sm text-foreground mb-1">
            {isDragActive
              ? "Drop your cc.json file here"
              : "Drag and drop your cc.json file"}
          </p>
          <p className="text-sm text-muted">or click to browse</p>
        </div>

        {/* Parsed Data Preview */}
        {parsedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-card rounded-md border border-border"
          >
            <h3 className="text-sm font-medium mb-3">File Summary</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Total Cost</span>
                <span className="font-mono">${formatCurrency(parsedData.totals.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Tokens</span>
                <span className="font-mono">{formatNumber(parsedData.totals.totalTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Days Tracked</span>
                <span className="font-mono">{parsedData.daily.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Date Range</span>
                <span className="font-mono text-xs">
                  {parsedData.daily[0]?.date} → {parsedData.daily[parsedData.daily.length - 1]?.date}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Status Messages */}
        <AnimatePresence>
          {uploadState === "error" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-3 bg-error/10 text-error rounded-md flex items-center gap-2 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
          
          {uploadState === "success" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-3 bg-green-500/10 text-green-500 rounded-md flex items-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Successfully submitted!</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Submit Button */}
        {parsedData && uploadState !== "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center gap-3"
          >
            <button
              onClick={handleSubmit}
              disabled={uploadState === "loading"}
              className="flex-1 py-3 px-6 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploadState === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Submit to Leaderboard</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                setParsedData(null);
                setUploadState("idle");
              }}
              className="px-6 py-3 border border-border rounded-md hover:bg-accent/10 transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}