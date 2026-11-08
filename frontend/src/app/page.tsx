"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Cpu,
  Layers,
  Zap,
  Lock,
  ArrowRight,
  FileSearch,
  Database,
  CheckCircle2,
  GitBranch,
  Activity,
  Server,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function HeroLandingPage() {
  const router = useRouter();
  const accessToken = useAppStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) {
      router.replace("/files");
    }
  }, [accessToken, router]);

  if (accessToken) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      <section className="relative py-16 sm:py-24 px-4">
        <div className="pointer-events-none absolute -top-28 left-1/4 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute top-40 right-10 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl animate-pulse-glow" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Enterprise Multi-Tenant RAG • Local BGE ONNX INT8 + OpenAI GPT</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08]">
              Document Intelligence Engineered for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400">
                Verifiable Truth.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              An end-to-end multi-tenant Retrieval-Augmented Generation platform featuring 3-stage structural-semantic parent-child chunking, local CPU{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">
                BAAI/bge-small-en-v1.5
              </code>{" "}
              &amp;{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">
                BAAI/bge-reranker-base
              </code>{" "}
              ONNX INT8 inference, Qdrant BM25 + Dense Reciprocal Rank Fusion, and non-blocking Redis Streams.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login?mode=register"
                className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition transform hover:-translate-y-0.5"
              >
                <span>Create Tenant Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold transition"
              >
                Sign In to Existing Account
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  384-Dim INT8
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Local BGE ONNX Vectors
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  RRF + CrossEncoder
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  2-Stage Hybrid Precision
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  PostgreSQL 17 RLS
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Row-Level Tenant Security
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  0-0 SSE Replay
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Zero-Drop Page Switching
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 animate-float">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    End-to-End RAG Execution Pipeline
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  LIVE ARCHITECTURE
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    01
                  </span>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Web Worker SHA-256 &amp; MinIO S3 Stream
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Deduplicates content hashes in browser worker, streams to tenant S3 prefix, and triggers Celery parser pool.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                    02
                  </span>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      3-Stage Structural + Semantic Parent-Child Chunking
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Detects headings, splits child chunks on BGE cosine similarity drops, and dynamic-batches &lt;15MB Qdrant upserts.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      03. Grounded Synthesis &amp; Inline Citations
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      182ms TTFT
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    Condenses multi-turn history, fuses Qdrant Dense + BM25, reranks via{" "}
                    <code className="font-mono">bge-reranker-base</code>, and streams cited tokens{" "}
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                      [1]
                    </span>{" "}
                    via Redis Streams.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Production-Grade Engineering Across Every Layer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Designed for strict tenant isolation, predictable CPU performance, and real-time observability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition">
              <Cpu className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Hybrid Cloud + Local CPU ONNX AI
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Zero local GPU overhead. Dense embeddings (`BAAI/bge-small-en-v1.5`), sparse BM25 (`Qdrant/bm25`), and cross-encoder reranking (`BAAI/bge-reranker-base`) execute on CPU INT8 while synthesis leverages OpenAI GPT.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition">
              <Server className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                4 Isolated Celery Worker Pools
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Dedicated `q_parser`, `q_embedding`, `q_chat`, and `q_maintenance` pools guarantee that heavy PDF ingestion never delays live conversational RAG token streaming.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/40 transition">
              <Lock className="w-7 h-7 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Quota Governance &amp; Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Built-in per-tenant file and question quotas (3 files &amp; 10 questions by default), real-time prompt/completion token tracking, and an Administrative Governance Console.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}