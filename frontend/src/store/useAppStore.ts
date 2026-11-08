"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CitationDTO, UserDTO } from "@/lib/api";

export interface LiveFileProgress {
  file_id: string;
  filename?: string;
  status: string;
  progress_pct: number;
  total_chunks: number;
  error_message?: string;
}

export interface LiveStreamingMessage {
  assistantMessageId: string;
  chatId: string;
  content: string;
  queryMode?: string;
  rewrittenQuery?: string;
  citations: CitationDTO[];
  status: "STREAMING" | "COMPLETED" | "FAILED";
  latencyMs?: number;
}

interface AppState {
  accessToken: string | null;
  user: UserDTO | null;
  selectedFileIds: string[];
  activeChatId: string | null;
  liveFileProgress: Record<string, LiveFileProgress>;
  liveStreams: Record<string, LiveStreamingMessage>;

  setAuth: (token: string, user: UserDTO) => void;
  clearAuth: () => void;
  toggleSelectedFileId: (fileId: string) => void;
  setSelectedFileIds: (ids: string[]) => void;
  setActiveChatId: (chatId: string | null) => void;
  upsertFileProgress: (item: LiveFileProgress) => void;
  initLiveStream: (chatId: string, assistantMessageId: string) => void;
  appendStreamToken: (assistantMessageId: string, delta: string) => void;
  setStreamMeta: (
    assistantMessageId: string,
    queryMode: string,
    rewrittenQuery: string
  ) => void;
  completeLiveStream: (
    assistantMessageId: string,
    citations: CitationDTO[],
    latencyMs?: number
  ) => void;
  failLiveStream: (assistantMessageId: string, errMessage: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      selectedFileIds: [],
      activeChatId: null,
      liveFileProgress: {},
      liveStreams: {},

      setAuth: (token, user) => set({ accessToken: token, user }),
      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
          selectedFileIds: [],
          activeChatId: null,
          liveFileProgress: {},
          liveStreams: {},
        }),

      toggleSelectedFileId: (fileId) =>
        set((state) => ({
          selectedFileIds: state.selectedFileIds.includes(fileId)
            ? state.selectedFileIds.filter((id) => id !== fileId)
            : [...state.selectedFileIds, fileId],
        })),

      setSelectedFileIds: (ids) => set({ selectedFileIds: ids }),
      setActiveChatId: (chatId) => set({ activeChatId: chatId }),

      upsertFileProgress: (item) =>
        set((state) => ({
          liveFileProgress: {
            ...state.liveFileProgress,
            [item.file_id]: {
              ...(state.liveFileProgress[item.file_id] || {}),
              ...item,
            },
          },
        })),

      initLiveStream: (chatId, assistantMessageId) =>
        set((state) => ({
          liveStreams: {
            ...state.liveStreams,
            [assistantMessageId]: {
              assistantMessageId,
              chatId,
              content: state.liveStreams[assistantMessageId]?.content || "",
              citations: state.liveStreams[assistantMessageId]?.citations || [],
              status: "STREAMING",
            },
          },
        })),

      appendStreamToken: (assistantMessageId, delta) =>
        set((state) => {
          const existing = state.liveStreams[assistantMessageId];
          if (!existing) return state;
          return {
            liveStreams: {
              ...state.liveStreams,
              [assistantMessageId]: {
                ...existing,
                content: existing.content + delta,
              },
            },
          };
        }),

      setStreamMeta: (assistantMessageId, queryMode, rewrittenQuery) =>
        set((state) => {
          const existing = state.liveStreams[assistantMessageId];
          if (!existing) return state;
          return {
            liveStreams: {
              ...state.liveStreams,
              [assistantMessageId]: {
                ...existing,
                queryMode,
                rewrittenQuery,
              },
            },
          };
        }),

      completeLiveStream: (assistantMessageId, citations, latencyMs) =>
        set((state) => {
          const existing = state.liveStreams[assistantMessageId];
          if (!existing) return state;
          return {
            liveStreams: {
              ...state.liveStreams,
              [assistantMessageId]: {
                ...existing,
                citations,
                latencyMs,
                status: "COMPLETED",
              },
            },
          };
        }),

      failLiveStream: (assistantMessageId, errMessage) =>
        set((state) => {
          const existing = state.liveStreams[assistantMessageId];
          if (!existing) return state;
          return {
            liveStreams: {
              ...state.liveStreams,
              [assistantMessageId]: {
                ...existing,
                content: errMessage,
                status: "FAILED",
              },
            },
          };
        }),
    }),
    {
      name: "enterprise-rag-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        selectedFileIds: state.selectedFileIds,
        activeChatId: state.activeChatId,
        liveStreams: state.liveStreams,
      }),
    }
  )
);