"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Cpu,
  Zap,
  Lock,
  ArrowRight,
  FileSearch,
  Database,
  CheckCircle2,
  Activity,
  Server,
  Layers,
  Sparkles,
  Terminal,
  BookOpen,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function HeroLandingPage() {
  const router = useRouter();
  const accessToken = useAppStore((s) => s.accessToken);
  const setNavigating = useAppStore((s) => s.setNavigating);

  useEffect(() => {
    if (accessToken) {
      router.replace("/dashboard");
    }
  }, [accessToken, router]);

  if (accessToken) {
    return null;
  }

  const go = (path: string) => {
    setNavigating(true);
    router.push(path);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      <section className="relative pt-14 pb-20 sm:pt-20 sm:pb-28 px-4">
        <div className="pointer-events-none absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute top-32 right-10 w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-glow" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Enterprise Multi-Tenant RAG v2.0 • CPU ONNX INT8 + OpenAI GPT</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.06]">
              Turn Private Documents into{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400">
                Auditable Intelligence.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Built for high-compliance engineering and enterprise teams. Combine 3-stage structural-semantic parent-child chunking, local CPU{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">
                BAAI/bge-small-en-v1.5
              </code>{" "}
              &amp;{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">
                BAAI/bge-reranker-base
              </code>{" "}
              ONNX INT8 models, Qdrant BM25 + Dense RRF fusion, and non-blocking Redis Streams.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => go("/login?mode=register")}
                className="px-7 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-2.5 shadow-xl shadow-emerald-600/25 transition transform hover:-translate-y-0.5"
              >
                <span>Launch Tenant Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => go("/login")}
                className="px-7 py-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold transition"
              >
                Sign In to Account
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  384-Dim INT8
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Local BGE ONNX Vectors
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  RRF + Reranker
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  2-Stage Hybrid Retrieval
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  Postgres 17 RLS
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Strict Row-Level Isolation
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  0-0 SSE Replay
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Resumable Token Streams
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 animate-float">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Live RAG Telemetry &amp; Citation Trace
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  PRODUCTION READY
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    STAGE 1
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      Staged Web Worker SHA-256 &amp; S3 Ingestion
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Stage PDF/DOCX files, verify SHA-256 deduplication in browser worker, and stream to MinIO S3.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    STAGE 2
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      3-Stage Hybrid Chunker &amp; &lt;15MB Qdrant Batches
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Parent-child semantic boundary detection with instant task cancellation on file delete.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      STAGE 3. Verified Grounded Answer
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      Rerank: 0.991
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    All tenant vectors are isolated via{" "}
                    <code className="font-mono">is_tenant: true</code> payload indices{" "}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                      [1]
                    </span>{" "}
                    and synthesized with live Redis Stream token replay{" "}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                      [2]
                    </span>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Full-Stack Enterprise RAG Architecture
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
              Every subsystem is isolated, observable, and optimized for zero-GPU CPU deployments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition shadow-sm">
              <Cpu className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Local ONNX INT8 + OpenAI GPT
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Embeddings (`BAAI/bge-small-en-v1.5`), sparse BM25 (`Qdrant/bm25`), and cross-encoder reranking (`BAAI/bge-reranker-base`) run locally on CPU INT8 while OpenAI GPT powers synthesis.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition shadow-sm">
              <Server className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                4 Dedicated Celery Worker Pools
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Isolated `q_parser`, `q_embedding`, `q_chat`, and `q_maintenance` queues prevent heavy document parsing from blocking real-time chat streaming.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition shadow-sm">
              <Lock className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Soft-Delete Audit &amp; Quota Controls
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Default tenant limits (3 files &amp; 10 questions), soft-delete audit preservation (`is_deleted = 1`), and real-time Admin quota management.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}