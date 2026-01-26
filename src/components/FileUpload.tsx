"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, Github } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useSubmit } from "@/lib/data/hooks/useSubmissions";

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
      } catch (error) {
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

  const handleSubmit = async () => {
    if (!parsedData) return;

    if (!session?.user?.username) {
      setErrorMessage("Please sign in with GitHub to submit.");
      setUploadState("error");
      return;
    }

    setUploadState("loading");
    try {
      await submit({
        username: session.user.username,
        githubUsername: session.user.username,
        githubName: session.user.name || undefined,
        githubAvatar: session.user.image || undefined,
        source: "oauth",
        verified: true,
        ccData: parsedData,
      });
      setUploadState("success");
      setParsedData(null);
      setTimeout(() => onSuccess?.(), 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit");
      setUploadState("error");
    }
  };

  return (
    <div>
      {/* Auth status */}
      {!session && (
        <div className="flex items-center justify-between p-2.5 mb-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
            <span>Sign in to get verified</span>
          </div>
          <button
            onClick={() => signIn("github")}
            className="text-xs px-2.5 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors flex items-center gap-1"
          >
            <Github className="w-3 h-3" />
            Sign in
          </button>
        </div>
      )}

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
            className="mt-3 p-2.5 bg-red-500/10 text-red-400 rounded-lg flex items-center gap-2 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {errorMessage}
          </motion.div>
        )}
        {uploadState === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 p-2.5 bg-green-500/10 text-green-400 rounded-lg flex items-center gap-2 text-xs"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Submitted successfully!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
