"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, MessageSquare, LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const liveStreams = useAppStore((s) => s.liveStreams);
  const liveFileProgress = useAppStore((s) => s.liveFileProgress);

  if (!user) return null;

  const activeStreamCount = Object.values(liveStreams).filter(
    (s) => s.status === "STREAMING"
  ).length;
  const activeUploadCount = Object.values(liveFileProgress).filter(
    (f) => f.status !== "READY" && f.status !== "FAILED"
  ).length;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Enterprise RAG QA</span>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/files"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                pathname.startsWith("/files")
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Knowledge Files</span>
              {activeUploadCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {activeUploadCount}
                </span>
              )}
            </Link>

            <Link
              href="/chat"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
                pathname.startsWith("/chat")
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>RAG Workspace</span>
              {activeStreamCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {activeStreamCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {user.full_name} ({user.email})
          </span>
          <button
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
            className="text-xs px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}