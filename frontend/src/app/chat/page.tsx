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
} from "lucide-react";
import {
  apiRequest,
  ChatMessageDTO,
  ChatSessionDTO,
  CitationDTO,
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

  const { data: chats = [] } = useQuery<ChatSessionDTO[]>({
    queryKey: ["chats"],
    queryFn: () => apiRequest<ChatSessionDTO[]>("/chats", {}, accessToken),
    enabled: Boolean(accessToken),
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !accessToken || submitting) return;

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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-3.5rem)] flex">
      <aside className="w-72 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
        <button
          onClick={handleNewChat}
          className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New RAG Conversation</span>
        </button>

        <div className="text-xs text-slate-400 px-1 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Scope:{" "}
            {selectedFileIds.length > 0
              ? `${selectedFileIds.length} selected file(s)`
              : "All tenant files"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChatId(c.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2.5 transition ${
                activeChatId === c.id
                  ? "bg-slate-800 text-white border border-slate-700"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-slate-950">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <Sparkles className="w-10 h-10 text-emerald-400 mb-3" />
              <h2 className="text-lg font-semibold text-white">
                Document-Grounded Conversational RAG
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ask questions, request comparisons, tables, or follow-up explanations grounded in your uploaded PDF & DOCX files. Navigating away never interrupts response streaming.
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
                    className={`max-w-3xl rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-900 border border-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {displayContent ||
                        (isStreaming ? "Retrieving & synthesizing from documents..." : "")}
                    </div>

                    {isStreaming && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Streaming tokens from Redis Stream...</span>
                      </div>
                    )}

                    {displayCitations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verified Document Citations ({displayCitations.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {displayCitations.map((cit) => (
                            <div
                              key={`${cit.chunk_id}_${cit.index}`}
                              className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs"
                            >
                              <div className="font-semibold text-emerald-300">
                                [{cit.index}] {cit.filename} (Page {cit.page_number})
                              </div>
                              {cit.section_heading && (
                                <div className="text-[11px] text-slate-400 truncate">
                                  Section: {cit.section_heading}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-300 mt-1 line-clamp-2">
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
          className="p-4 border-t border-slate-800 bg-slate-900/60"
        >
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your uploaded documents or follow up naturally..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white flex items-center gap-2 transition"
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