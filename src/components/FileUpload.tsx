"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, Github, LogOut } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession, signIn, signOut } from "next-auth/react";

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
  const { data: session, status } = useSession();
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
        const data = JSON.parse(content);
        
        // Validate the structure
        if (!data.daily || !data.totals) {
          throw new Error("Invalid cc.json format. Missing 'daily' or 'totals' field.");
        }
        
        setParsedData(data);
        setUploadState("idle");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to parse file");
        setUploadState("error");
      }
    };
    
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!parsedData || !session?.user) {
      setErrorMessage("Please sign in and upload a valid cc.json file");
      return;
    }

    setUploadState("loading");
    try {
      // Extract GitHub data from session
      const githubUsername = session.user.username;
      const githubName = session.user.name;
      
      // Transform the data to match our schema
      const transformedData = {
        ...parsedData,
        daily: parsedData.daily.map((day: any) => ({
          ...day,
          modelBreakdowns: day.modelBreakdowns?.map((mb: any) => ({
            model: mb.modelName || mb.model,
            inputTokens: mb.inputTokens,
            outputTokens: mb.outputTokens,
            cacheCreationTokens: mb.cacheCreationTokens,
            cacheReadTokens: mb.cacheReadTokens,
            totalTokens: mb.totalTokens,
            totalCost: mb.cost || mb.totalCost,
          }))
        }))
      };

      await submitMutation({
        username: githubUsername || session.user.email || "Anonymous",
        githubUsername: githubUsername || undefined,
        githubName: githubName || undefined,
        githubAvatar: session.user.image || undefined,
        ccData: transformedData,
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
        <h2 className="text-2xl font-light mb-2">Submit Your Stats</h2>
        
        {/* Auth Status */}
        {status === "loading" ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted" />
          </div>
        ) : session ? (
          <>
            <div className="flex items-center justify-between mb-6 p-3 bg-card rounded-md">
              <div className="flex items-center gap-3">
                <img 
                  src={session.user?.image || ""} 
                  alt={session.user?.name || ""} 
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="text-sm font-medium">{session.user.username || session.user?.name}</p>
                  <p className="text-xs text-muted">Signed in with GitHub</p>
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
            
            <p className="text-sm text-muted mb-4">
              Generate your stats file using{" "}
              <a 
                href="https://github.com/ryoppippi/ccusage" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                ccusage
              </a>
            </p>
            
            <div className="bg-background rounded-md p-3 mb-6">
              <code className="text-xs font-mono text-foreground">
                ccusage --json &gt; cc.json
              </code>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted mb-4">Sign in with GitHub to submit your stats</p>
            <button
              onClick={() => signIn("github")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#24292e] text-white rounded-md hover:bg-[#1a1e22] transition-colors"
            >
              <Github className="w-5 h-5" />
              Sign in with GitHub
            </button>
          </div>
        )}

        {/* File Upload - Only show when authenticated */}
        {session && (
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
        )}

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
                <span className="font-mono">${parsedData.totals.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Tokens</span>
                <span className="font-mono">{(parsedData.totals.totalTokens / 1e6).toFixed(1)}M</span>
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
              className="mt-4 p-3 bg-success/10 text-success rounded-md flex items-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Successfully submitted to the leaderboard!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        {session && parsedData && (
          <button
            onClick={handleSubmit}
            disabled={uploadState === "loading"}
            className="mt-8 w-full py-3 px-6 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
          {uploadState === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit to Leaderboard
            </>
          )}
          </button>
        )}
      </motion.div>
    </div>
  );
}