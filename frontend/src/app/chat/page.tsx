"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Send,
  MessageSquare,
  BookOpen,
  Sparkles,
  Loader2,
  FileCheck,
  Trash2,
  Cpu,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  apiRequest,
  ChatMessageDTO,
  ChatSessionDTO,
  CitationDTO,
  UserUsageTelemetryDTO,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

interface SubmitMessageResponse {
  user_message_id: string;
  assistant_message_id: string;
  chat_id: string;
  status: string;
  stream_channel: string;
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const accessToken = useAppStore((s) => s.accessToken);
  const activeChatId = useAppStore((s) => s.activeChatId);
  const setActiveChatId = useAppStore((s) => s.setActiveChatId);
  const selectedFileIds = useAppStore((s) => s.selectedFileIds);
  const liveStreams = useAppStore((s) => s.liveStreams);
  const initLiveStream = useAppStore((s) => s.initLiveStream);

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { data: chats = [] } = useQuery<ChatSessionDTO[]>({
    queryKey: ["chats"],
    queryFn: () => apiRequest<ChatSessionDTO[]>("/chats", {}, accessToken),
    enabled: Boolean(accessToken),
  });

  const { data: usage } = useQuery<UserUsageTelemetryDTO>({
    queryKey: ["my_usage"],
    queryFn: () =>
      apiRequest<UserUsageTelemetryDTO>("/users/me/usage", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats, setActiveChatId]);

  const { data: messages = [] } = useQuery<ChatMessageDTO[]>({
    queryKey: ["messages", activeChatId],
    queryFn: () =>
      apiRequest<ChatMessageDTO[]>(
        `/chats/${activeChatId}/messages`,
        {},
        accessToken
      ),
    enabled: Boolean(accessToken && activeChatId),
  });

  const questionsUsed = usage?.questions_used ?? 0;
  const maxQuestions = usage?.max_questions ?? 10;
  const questionLimitReached = questionsUsed >= maxQuestions;

  const handleNewChat = async () => {
    if (!accessToken) return;
    const created = await apiRequest<ChatSessionDTO>(
      "/chats",
      {
        method: "POST",
        body: JSON.stringify({
          title: "New Conversation",
          scoped_file_ids: selectedFileIds,
        }),
      },
      accessToken
    );
    await queryClient.invalidateQueries({ queryKey: ["chats"] });
    setActiveChatId(created.id);
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) return;
    await apiRequest(`/chats/${chatId}`, { method: "DELETE" }, accessToken);
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    await queryClient.invalidateQueries({ queryKey: ["chats"] });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !accessToken || submitting) return;

    setChatError(null);
    if (questionLimitReached) {
      setChatError(
        `Question limit reached (${questionsUsed}/${maxQuestions}). Contact Admin to increase your question quota.`
      );
      return;
    }

    const question = input.trim();
    setInput("");
    setSubmitting(true);

    try {
      let targetChatId = activeChatId;
      if (!targetChatId) {
        const created = await apiRequest<ChatSessionDTO>(
          "/chats",
          {
            method: "POST",
            body: JSON.stringify({
              title: question.slice(0, 60),
              scoped_file_ids: selectedFileIds,
            }),
          },
          accessToken
        );
        targetChatId = created.id;
        setActiveChatId(targetChatId);
        await queryClient.invalidateQueries({ queryKey: ["chats"] });
      }

      const submitRes = await apiRequest<SubmitMessageResponse>(
        `/chats/${targetChatId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: question,
            scoped_file_ids:
              selectedFileIds.length > 0 ? selectedFileIds : null,
          }),
        },
        accessToken
      );

      initLiveStream(targetChatId, submitRes.assistant_message_id);
      await queryClient.invalidateQueries({
        queryKey: ["messages", targetChatId],
      });
      await queryClient.invalidateQueries({ queryKey: ["my_usage"] });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] flex">
      <aside className="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex flex-col gap-3">
        <button
          onClick={handleNewChat}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New RAG Conversation</span>
        </button>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Questions Quota</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {questionsUsed} / {maxQuestions}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                questionLimitReached ? "bg-red-500" : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (questionsUsed / Math.max(1, maxQuestions)) * 100
                )}%`,
              }}
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Scope:{" "}
              {selectedFileIds.length > 0
                ? `${selectedFileIds.length} selected file(s)`
                : "All tenant files"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-1">
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveChatId(c.id)}
              className={`group w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition ${
                activeChatId === c.id
                  ? "bg-emerald-500/15 text-emerald-800 dark:text-white border border-emerald-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{c.title}</span>
              </div>
              <button
                onClick={(e) => handleDeleteChat(c.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-500 transition"
                title="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {chatError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <Sparkles className="w-10 h-10 text-emerald-500 mb-3" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Document-Grounded Conversational RAG
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ask questions, request comparisons, tables, or follow-up explanations grounded in your uploaded PDF &amp; DOCX files. Navigating away never interrupts response streaming.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const live = liveStreams[msg.id];
              const displayContent =
                msg.status === "STREAMING" && live ? live.content : msg.content;
              const displayCitations: CitationDTO[] =
                msg.citations && msg.citations.length > 0
                  ? msg.citations
                  : live?.citations || [];
              const queryMode = msg.query_mode || live?.queryMode;
              const latencyMs = msg.latency_ms ?? live?.latencyMs;
              const totalTokens = (msg.prompt_tokens || 0) + (msg.completion_tokens || 0);
              const isStreaming =
                msg.status === "STREAMING" && live?.status !== "COMPLETED";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-3xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {msg.role === "assistant" && (queryMode || latencyMs || totalTokens > 0) && (
                      <div className="flex flex-wrap items-center gap-2 mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        {queryMode && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            {queryMode}
                          </span>
                        )}
                        {latencyMs && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {latencyMs} ms
                          </span>
                        )}
                        {totalTokens > 0 && (
                          <span>
                            • {totalTokens} tokens ({msg.prompt_tokens} in /{" "}
                            {msg.completion_tokens} out)
                          </span>
                        )}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">
                      {displayContent ||
                        (isStreaming
                          ? "Retrieving & synthesizing from documents..."
                          : "")}
                    </div>

                    {isStreaming && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Streaming tokens from Redis Stream...</span>
                      </div>
                    )}

                    {displayCitations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                          <span>
                            Verified Document Citations ({displayCitations.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {displayCitations.map((cit) => (
                            <div
                              key={`${cit.chunk_id}_${cit.index}`}
                              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-300 truncate">
                                  [{cit.index}] {cit.filename} (p.{cit.page_number})
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  score: {cit.rerank_score}
                                </span>
                              </div>
                              {cit.section_heading && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  Section: {cit.section_heading}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                {cit.excerpt}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSend}
          className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <input
              type="text"
              disabled={questionLimitReached}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                questionLimitReached
                  ? `Question limit reached (${questionsUsed}/${maxQuestions})`
                  : "Ask anything about your uploaded documents or follow up naturally..."
              }
              className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={submitting || !input.trim() || questionLimitReached}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white flex items-center gap-2 shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}