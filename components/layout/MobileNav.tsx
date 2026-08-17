"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  Menu,
  PlayCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/#features", label: "Features", desc: "Everything the guard can do", icon: Sparkles },
  { href: "/docs", label: "Documentation", desc: "Quickstart, SDKs & API reference", icon: BookOpen },
  { href: "/demo", label: "Live Demo", desc: "See attacks blocked in real time", icon: PlayCircle },
  { href: "/playground", label: "Playground", desc: "Test the guard, no signup needed", icon: FlaskConical },
  { href: "/comparison", label: "Compare", desc: "SoterAI vs other AI security tools", icon: Scale },
  { href: "/benchmarks", label: "Benchmarks", desc: "Public evidence & methodology", icon: ShieldCheck },
];

/**
 * Mobile navigation drawer. On viewports below `xl` the full desktop header nav is
 * hidden, so without this a phone/tablet visitor has no way to reach Docs,
 * Pricing, Demo, Playground, etc. This restores that critical capability.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close the drawer whenever the route changes (covers in-page anchors too).
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Lock body scroll while open + restore focus to the trigger on close.
  useEffect(() => {
    if (open) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // Move focus into the panel for keyboard / screen-reader users.
      panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
    openButtonRef.current?.focus();
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";
  const dashboardLabel = isAdmin ? "Admin" : "Dashboard";

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Open navigation menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-900/60 text-slate-200 transition hover:border-cyan/50 hover:text-cyan"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] xl:hidden" role="dialog" aria-modal="true" aria-label="Site navigation">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            id="mobile-nav-panel"
            className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <span className="text-sm font-bold uppercase tracking-widest text-slate-200">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition hover:border-cyan/50 hover:text-cyan"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
              <ul className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = item.href !== "/#features" && pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-start gap-3 rounded-lg px-3 py-3 transition ${
                          active ? "bg-cyan/10 text-white" : "text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <Icon size={18} className={`mt-0.5 shrink-0 ${active ? "text-cyan" : "text-slate-300"}`} />
                        <span>
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-300">{item.desc}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t border-slate-800 px-4 py-4">
              {signedIn ? (
                <div className="flex flex-col gap-2">
                  <Link
                    href={dashboardHref}
                    onClick={() => setOpen(false)}
                    className="button-primary inline-flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard size={16} aria-hidden="true" /> {dashboardLabel}
                  </Link>
                  {session?.user?.email && (
                    <p className="truncate text-center text-xs text-slate-300">{session.user.email}</p>
                  )}
                  <div className="flex justify-center">
                    <SignOutButton />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="button-primary inline-flex items-center justify-center"
                  >
                    Create free account
                  </Link>
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan/50 hover:text-cyan"
                  >
                    <LogIn size={15} aria-hidden="true" /> Sign in
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
