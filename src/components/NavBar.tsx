"use client";

import { useEffect, useState } from "react";
import { Menu, X, LogOut, Sparkles } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Avatar from "./Avatar";
import UserMenu, { accountLinks } from "./UserMenu";
import { takeSubmitParam } from "@/lib/submit-modal";
import { isAdmin as checkIsAdmin } from "@/lib/admin";
import { currentWeek } from "./v2/week";
import { useBoardHref } from "./HomeVariant";
import { weekNumber } from "./v2/format";

// Modals only matter on interaction — split them out of the shell bundle
// (SubmitModal drags in react-dropzone via FileUpload).
const SubmitModal = dynamic(() => import("./SubmitModal"), { ssr: false });
const UpdatesModal = dynamic(() => import("./UpdatesModal"), { ssr: false });

const GITHUB = "https://github.com/sculptdotfun/viberank";

export function Logo() {
  return (
    <Link href="/" className="vr-logo" aria-label="viberank home">
      <span className="bars" aria-hidden><i /><i /><i /></span>
      viberank
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // "/week" must not light up on "/weeks", so match whole path segments.
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Site-wide nav, restyled for v2. Owns the submit + updates modals so any
// page can mount it with no props. "Join week NN" goes to /start, every way
// in; the submit modal still reopens after GitHub sign-in (?submit=1).
export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname() ?? "/";
  const login = session?.user?.username;
  const week = weekNumber(currentWeek());
  // The weekly board is "/" once VIBERANK_HOME=v2, and "/week" until then.
  const board = useBoardHref();

  // Back from "Sign in with GitHub to upload": reopen the modal they were in.
  // Read once from the URL rather than useSearchParams, which would opt
  // every static page that mounts the nav out of static rendering.
  useEffect(() => {
    if (takeSubmitParam()) setShowSubmit(true);
  }, []);

  const navItems = [
    { name: "Board", href: board },
    { name: "Records", href: "/records" },
    { name: "Fleets", href: "/fleets" },
    { name: "Wrapped 2026", href: "/wrapped/2026" },
    { name: "Data", href: "/data" },
    ...(checkIsAdmin(login) ? [{ name: "Admin", href: "/admin" }] : []),
  ];

  const join = (
    <Link href="/start" className="vr-btn" style={{ color: "var(--btn-ink)" }} suppressHydrationWarning>
      Join week {week}
    </Link>
  );

  return (
    <>
      <header className="vr-navwrap">
        <div className="vr-in vr-nav">
          <Logo />
          <nav className="vr-links" aria-label="Main">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="vr-nav-r">
            <a className="vr-hide-sm" href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
            {session ? (
              <span className="vr-hide-sm"><UserMenu login={login} name={session.user?.name} image={session.user?.image} /></span>
            ) : (
              <button type="button" className="vr-linkbtn vr-hide-sm" onClick={() => signIn("github")}>Sign in</button>
            )}
            {join}
            <button
              type="button"
              className="vr-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="vr-sheet">
            <div className="vr-in">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>{item.name}</Link>
              ))}
              <button type="button" onClick={() => { setShowUpdates(true); setMobileMenuOpen(false); }}>
                <Sparkles className="w-4 h-4" /> What&apos;s new
              </button>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
              <div className="vr-sheet-acct">
                {session ? (
                  <>
                    <span className="who">
                      <Avatar src={session.user?.image} name={session.user?.name || login} size="sm" showRing={false} className="w-5 h-5" />
                      {login ? `@${login}` : session.user?.name}
                    </span>
                    {accountLinks(login).map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)}>
                        <Icon className="w-4 h-4" /> {label}
                      </Link>
                    ))}
                    <button type="button" onClick={() => { signOut(); setMobileMenuOpen(false); }}>
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => { signIn("github"); setMobileMenuOpen(false); }}>Sign in with GitHub</button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {showSubmit && <SubmitModal open onClose={() => setShowSubmit(false)} />}
      {showUpdates && <UpdatesModal isOpen onClose={() => setShowUpdates(false)} />}
    </>
  );
}
