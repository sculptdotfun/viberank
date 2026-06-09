import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

// Friendly display labels for ccusage tool/agent keys.
const TOOL_LABELS: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
  copilot: "Copilot",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
  amp: "Amp",
  droid: "Droid",
  goose: "Goose",
  qwen: "Qwen",
  kimi: "Kimi",
  hermes: "Hermes",
  pi: "pi",
  codebuff: "Codebuff",
  kilo: "Kilo",
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool.toLowerCase()] ?? tool.charAt(0).toUpperCase() + tool.slice(1);
}

export function formatCurrency(num: number): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatLargeNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  };
  
  return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
}

export function getGitHubAvatarUrl(username: string, size: number = 40): string {
  return `https://github.com/${username}.png?size=${size}`;
}