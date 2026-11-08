"use client";

import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function ThemeSynchronizer() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return null;
}

function GlobalStreamManager() {
  const queryClient = useQueryClient();
  const accessToken = useAppStore((s) => s.accessToken);
  const liveStreams = useAppStore((s) => s.liveStreams);
  const upsertFileProgress = useAppStore((s) => s.upsertFileProgress);
  const appendStreamToken = useAppStore((s) => s.appendStreamToken);
  const setStreamMeta = useAppStore((s) => s.setStreamMeta);
  const completeLiveStream = useAppStore((s) => s.completeLiveStream);
  const failLiveStream = useAppStore((s) => s.failLiveStream);

  const activeChatSourcesRef = useRef<Record<string, EventSource>>({});

  useEffect(() => {
    if (!accessToken) return;
    const url = `${API_BASE_URL}/streams/files?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);

    es.addEventListener("file_progress", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        upsertFileProgress({
          file_id: data.file_id,
          status: data.status,
          progress_pct: Number(data.progress_pct || 0),
          total_chunks: Number(data.total_chunks || 0),
          error_message: data.error_message || undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [accessToken, upsertFileProgress, queryClient]);

  useEffect(() => {
    if (!accessToken) return;

    Object.values(liveStreams).forEach((streamItem) => {
      const msgId = streamItem.assistantMessageId;
      if (streamItem.status !== "STREAMING") {
        if (activeChatSourcesRef.current[msgId]) {
          activeChatSourcesRef.current[msgId].close();
          delete activeChatSourcesRef.current[msgId];
        }
        return;
      }

      if (activeChatSourcesRef.current[msgId]) {
        return;
      }

      const url = `${API_BASE_URL}/streams/chat/${msgId}?token=${encodeURIComponent(
        accessToken
      )}&last_id=0-0`;
      const es = new EventSource(url);
      activeChatSourcesRef.current[msgId] = es;

      es.addEventListener("meta", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          setStreamMeta(msgId, d.query_mode, d.rewrittenQuery);
        } catch {}
      });

      es.addEventListener("token", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          if (d.delta) {
            appendStreamToken(msgId, d.delta);
          }
        } catch {}
      });

      es.addEventListener("done", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data);
          completeLiveStream(msgId, d.citations || [], d.latency_ms);
          queryClient.invalidateQueries({
            queryKey: ["messages", streamItem.chatId],
          });
          queryClient.invalidateQueries({ queryKey: ["chats"] });
        } catch {}
        es.close();
        delete activeChatSourcesRef.current[msgId];
      });

      es.addEventListener("error", (e) => {
        try {
          const raw = (e as MessageEvent).data;
          if (raw) {
            const d = JSON.parse(raw);
            failLiveStream(msgId, d.message || "Generation failed");
          }
        } catch {}
      });
    });
  }, [
    accessToken,
    liveStreams,
    appendStreamToken,
    setStreamMeta,
    completeLiveStream,
    failLiveStream,
    queryClient,
  ]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSynchronizer />
      <GlobalStreamManager />
      {children}
    </QueryClientProvider>
  );
}