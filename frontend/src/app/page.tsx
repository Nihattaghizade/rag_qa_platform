"use client";

import Link from "next/link";
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
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export default function HeroLandingPage() {
  const accessToken = useAppStore((s) => s.accessToken);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <section className="relative overflow-hidden py-16 sm:py-24 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Production Multi-Tenant RAG Architecture • CPU ONNX INT8 + OpenAI GPT</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Enterprise Document Intelligence with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                Zero-Hallucination
              </span>{" "}
              Precision.
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Upload massive PDF and DOCX repositories with non-blocking Web Worker pipelines. Powered by 3-stage structural-semantic hybrid chunking, local{" "}
              <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-mono">
                BAAI/bge
              </code>{" "}
              ONNX INT8 vectors, Qdrant BM25 + Dense fusion, Cross-Encoder reranking, and resumable Redis Streams.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              {accessToken ? (
                <>
                  <Link
                    href="/files"
                    className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                  >
                    <span>Open Knowledge Base</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/chat"
                    className="px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold transition"
                  >
                    Launch RAG Chat
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login?mode=register"
                    className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                  >
                    <span>Create Tenant Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold transition"
                  >
                    Sign In to Workspace
                  </Link>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  PostgreSQL RLS + Qdrant Tenant Isolation
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">3-Stage</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Parent-Child Semantic Hybrid Chunker
                </div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">0-0 Stream</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Non-Blocking Resumable Token Replay
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Live RAG Pipeline Telemetry
                  </span>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    User Query (Conversational Follow-up)
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    &ldquo;Compare the security isolation policies in section 2 and summarize the upload limits in a table.&rdquo;
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Synthesized Response with Verified Citations
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      Rerank Score: 0.984
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                    Every tenant document is isolated via PostgreSQL 17 Row-Level Security{" "}
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                      [1]
                    </span>{" "}
                    and Qdrant tenant-indexed payload filters{" "}
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                      [2]
                    </span>
                    , supporting up to 500 MB per file.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <Cpu className="w-6 h-6 text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Local CPU ONNX INT8 BGE
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              BAAI/bge-small-en-v1.5 embeddings & BAAI/bge-reranker-base cross-encoder run locally on CPU with zero GPU cost.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <FileSearch className="w-6 h-6 text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hybrid Dense + BM25 RRF
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Combines semantic vector similarity with exact Qdrant/bm25 keyword matching and Reciprocal Rank Fusion.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <Zap className="w-6 h-6 text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Non-Blocking UX & Streams
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Switch freely between Knowledge Files and RAG Chat without interrupting uploads or live token generation.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <Lock className="w-6 h-6 text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Strict Tenant Isolation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enforced across PostgreSQL RLS policies, Qdrant tenant indices, S3 key prefixes, and 4-tier semantic cache.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}