"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Github, Sparkles, Menu, X, Shield, BookOpen, BarChart3 } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  
  const isAdmin = session?.user?.username && ADMIN_USERS.includes(session.user.username);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "Blog", href: "/blog", icon: BookOpen },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 hidden md:block transition-all duration-300 ${
          scrolled ? "top-2" : ""
        }`}
      >
        <motion.div
          className={`bg-background/80 backdrop-blur-xl border border-border/50 rounded-full px-2 py-2 shadow-lg transition-all duration-300 ${
            scrolled ? "shadow-xl border-border" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-accent/10 transition-colors"
            >
              <div className="relative flex items-center justify-center w-6 h-6">
                {/* Modern bar chart icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75"/>
                  <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor"/>
                </svg>
              </div>
              <span className="font-semibold tracking-tight">viberank</span>
            </Link>

            {/* Nav Items */}
            {navItems.length > 0 && (
              <div className="flex items-center gap-1 px-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  
                  return (
                    <Link key={item.name} href={item.href!}>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2 text-sm ${
                          isActive
                            ? "bg-accent text-white"
                            : "hover:bg-accent/10"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.name}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Right side actions */}
            <div className="flex items-center gap-2 px-2">
              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onUploadClick}
                className="px-4 py-2 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Submit
              </motion.button>

              {/* Auth Button */}
              {session ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent/10 transition-colors text-sm"
                >
                  <Avatar
                    src={session.user?.image}
                    name={session.user?.name || session.user?.username}
                    size="sm"
                    showRing={false}
                    className="w-5 h-5"
                  />
                  <span className="hidden lg:inline">Sign out</span>
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signIn("github")}
                  className="px-4 py-2 rounded-full border border-border hover:bg-accent/10 transition-colors text-sm flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  Sign in
                </motion.button>
              )}

              {/* Secondary actions */}
              <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onUpdatesClick}
                  className="p-2 rounded-full hover:bg-accent/10 transition-colors relative"
                >
                  <Sparkles className="w-4 h-4" />
                  <motion.span
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.button>

                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com/sculptdotfun/viberank"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full hover:bg-accent/10 transition-colors"
                >
                  <Github className="w-4 h-4" />
                </motion.a>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.header>

      {/* Mobile Navigation */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1918] backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
              <rect x="3" y="14" width="5" height="7" rx="1" fill="currentColor" opacity="0.5"/>
              <rect x="9.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.75"/>
              <rect x="16" y="3" width="5" height="18" rx="1" fill="currentColor"/>
            </svg>
            <span className="font-semibold tracking-tight">viberank</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Submit Button */}
            <button
              onClick={() => {
                onUploadClick();
                setMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-full bg-accent text-white text-sm flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Submit
            </button>

            {/* Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border/50 bg-[#1a1918] backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-2">
                {/* Admin link if applicable */}
                {navItems.map((item) => {
                  const Icon = item.icon;
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href!}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="px-4 py-3 rounded-lg hover:bg-accent/10 transition-colors flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        {item.name}
                      </div>
                    </Link>
                  );
                })}
                
                {/* Secondary Actions */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <button
                    onClick={() => {
                      onUpdatesClick();
                      setMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <a
                    href="https://github.com/sculptdotfun/viberank"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
                
                <div className="border-t border-border/50 pt-2 mt-2">
                  {session ? (
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg hover:bg-accent/10 transition-colors flex items-center gap-3 text-left"
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
                      onClick={() => {
                        signIn("github");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg border border-border hover:bg-accent/10 transition-colors flex items-center justify-center gap-2"
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