"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className={className ?? "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white"}
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
