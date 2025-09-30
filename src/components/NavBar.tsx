"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Upload, Github, Menu, X, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavBarProps {
  onUploadClick: () => void;
}

const ADMIN_USERS = ["nikshepsvn"];

export default function NavBar({ onUploadClick }: NavBarProps) {
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


              {/* GitHub link */}
              <div className="flex items-center gap-1 border-l border-border/50 pl-2">
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com/EastAgile/viberank"
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
            <Trophy className="w-5 h-5 text-accent" />
            <span className="font-semibold">viberank</span>
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
                
                {/* GitHub Link */}
                <div className="flex items-center gap-3 px-4 py-2">
                  <a
                    href="https://github.com/sculptdotfun/viberank"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-accent/10 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}