"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Upload, Github, Sparkles, TrendingUp, Menu, X, Shield } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    { name: "Leaderboard", href: "/", icon: Trophy },
    { name: "Upload", onClick: onUploadClick, icon: Upload },
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
              className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-accent/10 transition-colors"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-accent/20 rounded-lg blur-xl" />
                <div className="relative">
                  <Trophy className="w-5 h-5 text-accent" />
                </div>
              </div>
              <span className="font-semibold">viberank</span>
            </Link>

            {/* Nav Items */}
            <div className="flex items-center gap-1 px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                if (item.onClick) {
                  return (
                    <motion.button
                      key={item.name}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={item.onClick}
                      className="px-4 py-2 rounded-full hover:bg-accent/10 transition-all duration-200 flex items-center gap-2 text-sm"
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </motion.button>
                  );
                }
                
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

            {/* Right side actions */}
            <div className="flex items-center gap-1 px-2 border-l border-border/50">
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

              {/* Auth Button */}
              {session ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-accent/10 transition-colors text-sm"
                >
                  <img
                    src={session.user?.image || ""}
                    alt={session.user?.name || ""}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="hidden lg:inline">Sign out</span>
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => signIn("github")}
                  className="px-4 py-2 rounded-full bg-accent text-white hover:bg-accent/90 transition-colors text-sm"
                >
                  Sign in
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.header>

      {/* Mobile Navigation */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            <span className="font-semibold">viberank</span>
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border/50 bg-background"
            >
              <div className="px-4 py-4 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  
                  if (item.onClick) {
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          item.onClick();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 rounded-lg hover:bg-accent/10 transition-colors flex items-center gap-3 text-left"
                      >
                        <Icon className="w-4 h-4" />
                        {item.name}
                      </button>
                    );
                  }
                  
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
                
                <div className="border-t border-border/50 pt-2 mt-2">
                  {session ? (
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg hover:bg-accent/10 transition-colors flex items-center gap-3 text-left"
                    >
                      <img
                        src={session.user?.image || ""}
                        alt={session.user?.name || ""}
                        className="w-5 h-5 rounded-full"
                      />
                      Sign out
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        signIn("github");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
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