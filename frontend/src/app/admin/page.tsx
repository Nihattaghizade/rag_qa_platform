"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Users,
  FileText,
  MessageSquare,
  Cpu,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
import {
  AdminDashboardOverviewDTO,
  AdminUserSummaryDTO,
  apiRequest,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const accessToken = useAppStore((s) => s.accessToken);
  const currentUser = useAppStore((s) => s.user);

  const [edits, setEdits] = useState<
    Record<string, { max_files: number; max_questions: number; role: "user" | "admin" }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery<AdminDashboardOverviewDTO>({
    queryKey: ["admin_overview"],
    queryFn: () =>
      apiRequest<AdminDashboardOverviewDTO>("/admin/overview", {}, accessToken),
    enabled: Boolean(accessToken && currentUser?.role === "admin"),
    refetchInterval: 5000,
  });

  if (currentUser?.role !== "admin") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Administrator Access Only
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Sign in as admin@enterprise.io to manage tenant users and quotas.
        </p>
      </div>
    );
  }

  const handleSaveLimits = async (u: AdminUserSummaryDTO) => {
    if (!accessToken) return;
    const draft = edits[u.id] || {
      max_files: u.max_files,
      max_questions: u.max_questions,
      role: u.role,
    };
    setSavingId(u.id);
    try {
      await apiRequest(
        `/admin/users/${u.id}/limits`,
        {
          method: "PATCH",
          body: JSON.stringify(draft),
        },
        accessToken
      );
      await queryClient.invalidateQueries({ queryKey: ["admin_overview"] });
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!accessToken) return;
    await apiRequest(`/admin/users/${userId}`, { method: "DELETE" }, accessToken);
    await queryClient.invalidateQueries({ queryKey: ["admin_overview"] });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-purple-500" />
            <span>Platform Admin Governance &amp; Quota Control</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Monitor all tenants, token consumption, indexed files, and dynamically adjust upload &amp; chat limits.
          </p>
        </div>
      </div>

      {isLoading || !overview ? (
        <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading platform-wide telemetry...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Total Tenant Users</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview.total_users}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Indexed Files &amp; Chunks</span>
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview.total_files} files
              </div>
              <div className="text-[11px] text-slate-500">
                {overview.total_chunks.toLocaleString()} parent-child chunks in Qdrant
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Total RAG Questions Asked</span>
                <MessageSquare className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview.total_questions_asked}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Platform Token Usage</span>
                <Cpu className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {overview.total_tokens.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500">
                In: {overview.total_prompt_tokens.toLocaleString()} • Out:{" "}
                {overview.total_completion_tokens.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Tenant Directory, Usage Telemetry &amp; Quota Controls
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tenant User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Files (Used / Max)</th>
                    <th className="py-3 px-4">Questions (Used / Max)</th>
                    <th className="py-3 px-4">Chunks / Storage</th>
                    <th className="py-3 px-4">Tokens Used</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {overview.users.map((u) => {
                    const draft = edits[u.id] || {
                      max_files: u.max_files,
                      max_questions: u.max_questions,
                      role: u.role,
                    };

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {u.full_name}
                          </div>
                          <div className="text-slate-500">{u.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={draft.role}
                            onChange={(e) =>
                              setEdits({
                                ...edits,
                                [u.id]: {
                                  ...draft,
                                  role: e.target.value as "user" | "admin",
                                },
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{u.files_used} /</span>
                            <input
                              type="number"
                              min={0}
                              value={draft.max_files}
                              onChange={(e) =>
                                setEdits({
                                  ...edits,
                                  [u.id]: {
                                    ...draft,
                                    max_files: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-16 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{u.questions_used} /</span>
                            <input
                              type="number"
                              min={0}
                              value={draft.max_questions}
                              onChange={(e) =>
                                setEdits({
                                  ...edits,
                                  [u.id]: {
                                    ...draft,
                                    max_questions: Number(e.target.value),
                                  },
                                })
                              }
                              className="w-20 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div>{u.total_chunks} chunks</div>
                          <div className="text-[11px] text-slate-500">
                            {(u.storage_used_bytes / 1024).toFixed(1)} KB
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {u.total_tokens.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.total_prompt_tokens} in / {u.total_completion_tokens} out
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleSaveLimits(u)}
                              disabled={savingId === u.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 transition"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{savingId === u.id ? "Saving" : "Save"}</span>
                            </button>

                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                title="Delete User & Data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}