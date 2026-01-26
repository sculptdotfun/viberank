"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Github, Sparkles, Menu, X, Shield, BookOpen } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";

interface NavBarProps {
  onUploadClick: () => void;
  onUpdatesClick: () => void;
}

const ADMIN_USERS = ["nikshepsvn"];

export default function NavBar({ onUploadClick, onUpdatesClick }: NavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = session?.user?.username && ADMIN_USERS.includes(session.user.username);

  const navItems = [
    { name: "Blog", href: "/blog", icon: BookOpen },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
  ];

  return (
    <>
      {/* Desktop Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur border-b border-border hidden md:flex items-center">
        <div className="w-full px-6 flex items-center justify-between">
          {/* Left: Logo + Nav Items */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
                <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5"/>
                <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75"/>
                <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor"/>
              </svg>
              <span className="font-semibold text-lg">viberank</span>
            </Link>

            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 transition-colors ${
                      isActive ? "bg-accent text-white" : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onUploadClick}
              className="px-4 py-2 bg-accent text-white text-sm rounded-md font-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Submit
            </button>

            <button
              onClick={onUpdatesClick}
              className="p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-md transition-colors relative"
            >
              <Sparkles className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" />
            </button>

            <a
              href="https://github.com/sculptdotfun/viberank"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-md transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>

            {session ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors"
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
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-surface-2 transition-colors flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-full px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
              <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5"/>
              <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75"/>
              <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor"/>
            </svg>
            <span className="font-semibold">viberank</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={onUploadClick}
              className="px-3 py-1.5 bg-accent text-white text-sm rounded-md font-medium flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Submit
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-muted hover:text-foreground"
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
              <div className="px-4 py-3 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-surface-2"
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </Link>
                  );
                })}

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => { onUpdatesClick(); setMobileMenuOpen(false); }}
                    className="p-2 text-muted hover:text-foreground"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <a
                    href="https://github.com/sculptdotfun/viberank"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted hover:text-foreground"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>

                <div className="pt-2 border-t border-border">
                  {session ? (
                    <button
                      onClick={() => { signOut(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-surface-2"
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
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded"
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
    </>
  );
}
