"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  MessageSquare,
  Cpu,
  ShieldCheck,
  ArrowRight,
  UploadCloud,
  Sparkles,
  Settings,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  apiRequest,
  ChatSessionDTO,
  FileRecordDTO,
  UserUsageTelemetryDTO,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function MainDashboardPage() {
  const router = useRouter();
  const accessToken = useAppStore((s) => s.accessToken);
  const user = useAppStore((s) => s.user);
  const setNavigating = useAppStore((s) => s.setNavigating);
  const setActiveChatId = useAppStore((s) => s.setActiveChatId);

  const { data: usage, isLoading } = useQuery<UserUsageTelemetryDTO>({
    queryKey: ["my_usage"],
    queryFn: () =>
      apiRequest<UserUsageTelemetryDTO>("/users/me/usage", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 5000,
  });

  const { data: files = [] } = useQuery<FileRecordDTO[]>({
    queryKey: ["files"],
    queryFn: () => apiRequest<FileRecordDTO[]>("/files", {}, accessToken),
    enabled: Boolean(accessToken),
  });

  const { data: chats = [] } = useQuery<ChatSessionDTO[]>({
    queryKey: ["chats"],
    queryFn: () => apiRequest<ChatSessionDTO[]>("/chats", {}, accessToken),
    enabled: Boolean(accessToken),
  });

  const go = (path: string) => {
    setNavigating(true);
    router.push(path);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Authenticated Tenant Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">
            Welcome back, {user?.full_name || "Enterprise User"}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-50 max-w-2xl">
            Your private multi-tenant knowledge base is isolated with PostgreSQL 17 Row-Level Security and Qdrant tenant payload indexing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => go("/files")}
            className="px-5 py-3 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold flex items-center gap-2 shadow-lg transition"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Documents</span>
          </button>
          <button
            onClick={() => go("/chat")}
            className="px-5 py-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-950/70 border border-white/25 text-white text-xs font-bold flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask RAG Assistant</span>
          </button>
        </div>
      </div>

      {isLoading || !usage ? (
        <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading workspace metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Document Quota</span>
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
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
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Chat Questions Used</span>
              <MessageSquare className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
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
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Tokens Used</span>
              <Cpu className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {usage.total_tokens.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500">
              Prompt: {usage.total_prompt_tokens} • Out: {usage.total_completion_tokens}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Average Response Latency</span>
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {usage.avg_latency_ms} ms
            </div>
            <div className="text-[11px] text-slate-500">
              BGE ONNX INT8 + OpenAI GPT
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Knowledge Documents ({files.length})
            </h2>
            <button
              onClick={() => go("/files")}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
            >
              <span>Manage Files</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {files.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No files uploaded yet. Go to Knowledge Files to stage and upload documents.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {files.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="px-6 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {f.filename}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {f.total_chunks} chunks • {(f.size_bytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent RAG Conversations ({chats.length})
            </h2>
            <button
              onClick={() => go("/chat")}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {chats.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No conversations started yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {chats.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveChatId(c.id);
                    go("/chat");
                  }}
                  className="w-full text-left px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {c.title}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}