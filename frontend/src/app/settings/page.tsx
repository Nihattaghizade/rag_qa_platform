"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  KeyRound,
  Activity,
  FileText,
  MessageSquare,
  Cpu,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { apiRequest, UserUsageTelemetryDTO } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const accessToken = useAppStore((s) => s.accessToken);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const { data: usage, isLoading } = useQuery<UserUsageTelemetryDTO>({
    queryKey: ["my_usage"],
    queryFn: () =>
      apiRequest<UserUsageTelemetryDTO>("/users/me/usage", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 5000,
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setPwdSaving(true);
    setPwdMessage(null);
    setPwdError(null);

    try {
      const res = await apiRequest<{ status: string }>(
        "/users/me/password",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
        accessToken
      );
      setPwdMessage(res.status);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Personal Usage Telemetry &amp; Account Settings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Monitor your personal upload limits, chat question quota, OpenAI token consumption, and security credentials.
        </p>
      </div>

      {isLoading || !usage ? (
        <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading your usage telemetry...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>File Upload Limit</span>
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {usage.files_used} / {usage.max_files}
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (usage.files_used / Math.max(1, usage.max_files)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Storage: {(usage.storage_used_bytes / 1024).toFixed(1)} KB used
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Chat Questions Quota</span>
                <MessageSquare className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {usage.questions_used} / {usage.max_questions}
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (usage.questions_used / Math.max(1, usage.max_questions)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Active Conversations: {usage.total_chat_sessions}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Tokens Consumed</span>
                <Cpu className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {usage.total_tokens.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                Prompt: {usage.total_prompt_tokens.toLocaleString()} • Completion:{" "}
                {usage.total_completion_tokens.toLocaleString()}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Average RAG Latency</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {usage.avg_latency_ms} ms
              </div>
              <div className="text-[11px] text-slate-500">
                Hybrid BGE + Reranker + GPT
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 self-start">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Change Account Password
                </h2>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                {pwdMessage && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{pwdMessage}</span>
                  </div>
                )}

                {pwdError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
                    {pwdError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                >
                  {pwdSaving ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Your Recent RAG Query &amp; Token Ledger
                </h2>
              </div>

              {usage.recent_activity.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No RAG queries executed yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {usage.recent_activity.map((act) => (
                    <div key={act.id} className="px-6 py-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-md">
                          {act.rewritten_query || "Document RAG Query"}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                          {act.total_tokens} tokens
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                        <span>Mode: {act.query_mode}</span>
                        <span>•</span>
                        <span>
                          In: {act.prompt_tokens} / Out: {act.completion_tokens}
                        </span>
                        <span>•</span>
                        <span>Latency: {act.latency_ms ?? 0} ms</span>
                        <span>•</span>
                        <span>Citations: {act.citations_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}