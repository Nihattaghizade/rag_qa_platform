"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Loader2,
  Sun,
  Moon,
  Sparkles,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setNavigating = useAppStore((s) => s.setNavigating);
  const user = useAppStore((s) => s.user);
  const accessToken = useAppStore((s) => s.accessToken);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const liveStreams = useAppStore((s) => s.liveStreams);
  const liveFileProgress = useAppStore((s) => s.liveFileProgress);

  const isAuthenticated = Boolean(accessToken && user);
  const userRole = user?.role || "user";

  const activeStreamCount = Object.values(liveStreams).filter(
    (s) => s.status === "STREAMING"
  ).length;
  const activeUploadCount = Object.values(liveFileProgress).filter(
    (f) =>
      f.status !== "READY" && f.status !== "FAILED" && f.status !== "DELETED"
  ).length;

  const navigateTo = (targetPath: string) => {
    if (pathname === targetPath) return;
    setNavigating(true);
    router.push(targetPath);
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigateTo(isAuthenticated ? "/dashboard" : "/")}
            className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white hover:opacity-90 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span>Enterprise RAG QA</span>
          </button>

          {isAuthenticated && (
            <nav className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigateTo("/dashboard")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  pathname.startsWith("/dashboard")
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Main Hub</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo("/files")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  pathname.startsWith("/files")
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Knowledge Files</span>
                {activeUploadCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {activeUploadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigateTo("/chat")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  pathname.startsWith("/chat")
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>RAG Workspace</span>
                {activeStreamCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {activeStreamCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigateTo("/settings")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  pathname.startsWith("/settings")
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Usage &amp; Settings</span>
              </button>

              {userRole === "admin" && (
                <button
                  type="button"
                  onClick={() => navigateTo("/admin")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                    pathname.startsWith("/admin")
                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                      : "text-purple-600 dark:text-purple-300 hover:bg-purple-500/10"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Admin Control</span>
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 transition"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {isAuthenticated && user ? (
            <>
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {user.full_name}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {user.email} • {userRole.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNavigating(true);
                  clearAuth();
                  router.push("/login");
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateTo("/login")}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/login?mode=register")}
                className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}