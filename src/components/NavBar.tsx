"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Github, Sparkles, Menu, X } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Avatar from "./Avatar";

// Modals only matter on interaction — split them out of the shell bundle
// (SubmitModal drags in react-dropzone via FileUpload).
const SubmitModal = dynamic(() => import("./SubmitModal"), { ssr: false });
const UpdatesModal = dynamic(() => import("./UpdatesModal"), { ssr: false });
import { isAdmin as checkIsAdmin } from "@/lib/admin";

function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-accent">
        <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75" />
        <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor" />
      </svg>
      <span className="font-mono font-semibold tracking-tight">viberank</span>
    </>
  );
}

// Site-wide nav. Owns the submit + updates modals so any page can mount it
// with no props.
export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = checkIsAdmin(session?.user?.username);

  const navItems = [
    { name: "Blog", href: "/blog" },
    ...(isAdmin ? [{ name: "Admin", href: "/admin" }] : []),
  ];

  return (
    <>
      {/* Desktop Nav */}
      <header className="sticky top-0 z-50 h-14 bg-background/95 backdrop-blur border-b border-border hidden md:flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-between">
          {/* Left: Logo + Nav Items */}
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2 text-lg hover:opacity-80 transition-opacity">
              <Wordmark />
            </Link>

            <div className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 h-8 inline-flex items-center text-sm rounded-md transition-colors ${
                      isActive ? "text-foreground bg-surface-2" : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpdates(true)}
              aria-label="What's new"
              className="relative h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 rounded-md transition-colors"
            >
              <Sparkles className="w-[18px] h-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
            </button>

            <a
              href="https://github.com/sculptdotfun/viberank"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 rounded-md transition-colors"
            >
              <Github className="w-[18px] h-[18px]" />
            </a>

            {session ? (
              <button
                onClick={() => signOut()}
                className="h-9 inline-flex items-center gap-2 px-2.5 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors"
              >
                <Avatar
                  src={session.user?.image}
                  name={session.user?.name || session.user?.username}
                  size="sm"
                  showRing={false}
                  className="w-6 h-6"
                />
                <span className="hidden lg:inline text-muted">Sign out</span>
              </button>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="h-9 inline-flex items-center gap-2 px-3.5 text-sm font-medium border border-border rounded-md hover:bg-surface-2 transition-colors"
              >
                <Github className="w-4 h-4" />
                Sign in
              </button>
            )}

            <button
              onClick={() => setShowSubmit(true)}
              className="h-9 inline-flex items-center gap-2 px-3.5 bg-accent text-white text-sm rounded-md font-medium hover:bg-accent-hover transition-colors btn-glow"
            >
              <Upload className="w-4 h-4" />
              Submit
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <header className="md:hidden sticky top-0 z-50 h-14 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark size={18} />
          </Link>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSubmit(true)}
              className="h-8 inline-flex items-center gap-1.5 px-3 bg-accent text-white text-sm rounded-md font-medium"
            >
              <Upload className="w-3.5 h-3.5" />
              Submit
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              className="h-8 w-8 inline-flex items-center justify-center text-muted hover:text-foreground rounded-md"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-background border-b border-border"
            >
              <div className="px-4 py-3 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm rounded-md hover:bg-surface-2"
                  >
                    {item.name}
                  </Link>
                ))}
                <button
                  onClick={() => { setShowUpdates(true); setMobileMenuOpen(false); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-2"
                >
                  <Sparkles className="w-4 h-4 text-muted" />
                  What&apos;s new
                </button>
                <a
                  href="https://github.com/sculptdotfun/viberank"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-2"
                >
                  <Github className="w-4 h-4 text-muted" />
                  GitHub
                </a>

                <div className="pt-2 border-t border-border">
                  {session ? (
                    <button
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-surface-2"
                    >
                      <Avatar
                        src={session.user?.image}
                        name={session.user?.name || session.user?.username}
                        size="sm"
                        showRing={false}
                        className="w-5 h-5"
                      />
                      Sign out
                    </button>
                  ) : (
                    <button
                      onClick={() => { signIn("github"); setMobileMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-surface-2"
                    >
                      <Github className="w-4 h-4" />
                      Sign in with GitHub
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {showSubmit && <SubmitModal open onClose={() => setShowSubmit(false)} />}
      {showUpdates && <UpdatesModal isOpen onClose={() => setShowUpdates(false)} />}
    </>
  );
}
