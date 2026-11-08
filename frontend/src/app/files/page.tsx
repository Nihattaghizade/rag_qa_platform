"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { API_BASE_URL, apiRequest, FileRecordDTO } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function FilesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accessToken = useAppStore((s) => s.accessToken);
  const selectedFileIds = useAppStore((s) => s.selectedFileIds);
  const toggleSelectedFileId = useAppStore((s) => s.toggleSelectedFileId);
  const liveFileProgress = useAppStore((s) => s.liveFileProgress);
  const upsertFileProgress = useAppStore((s) => s.upsertFileProgress);

  const { data: files = [], isLoading } = useQuery<FileRecordDTO[]>({
    queryKey: ["files"],
    queryFn: () => apiRequest<FileRecordDTO[]>("/files", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 4000,
  });

  const handleFileUpload = (fileList: FileList | null) => {
    if (!fileList || !accessToken) return;

    Array.from(fileList).forEach((file) => {
      const tempJobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const worker = new Worker("/upload-worker.js");

      worker.onmessage = (event) => {
        const { fileRecord, status, progress } = event.data;
        if (fileRecord?.id) {
          upsertFileProgress({
            file_id: fileRecord.id,
            filename: file.name,
            status: status || fileRecord.status,
            progress_pct: progress || fileRecord.progress_pct,
            total_chunks: fileRecord.total_chunks || 0,
          });
          queryClient.invalidateQueries({ queryKey: ["files"] });
          worker.terminate();
        }
      };

      worker.postMessage({
        jobId: tempJobId,
        file,
        apiBaseUrl: API_BASE_URL,
        token: accessToken,
      });
    });
  };

  const handleDelete = async (fileId: string) => {
    if (!accessToken) return;
    await apiRequest(`/files/${fileId}`, { method: "DELETE" }, accessToken);
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tenant Knowledge Base
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upload PDF or DOCX documents. Background parsing, 3-stage hybrid chunking, and byte-batched Qdrant indexing continue even if you switch to Chat.
          </p>
        </div>

        <button
          onClick={() => router.push("/chat")}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white flex items-center gap-2 self-start shadow-md shadow-emerald-600/20 transition"
        >
          <MessageSquare className="w-4 h-4" />
          <span>
            Open RAG Chat{" "}
            {selectedFileIds.length > 0
              ? `(${selectedFileIds.length} scoped)`
              : "(All Files)"}
          </span>
        </button>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 bg-white dark:bg-slate-900/50 rounded-2xl p-8 text-center cursor-pointer transition"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <UploadCloud className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Click to select PDF or DOCX files (Background Web Worker Upload)
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          SHA-256 deduplicated • Isolated per tenant • Dynamic &lt;15MB Qdrant Batch Upserts
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Uploaded Documents ({files.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Check documents to scope your next RAG conversation
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No documents uploaded yet. Upload a PDF or DOCX above to begin.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {files.map((file) => {
              const live = liveFileProgress[file.id];
              const status = live?.status || file.status;
              const progress = live?.progress_pct ?? file.progress_pct;
              const chunks = live?.total_chunks || file.total_chunks;
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <div
                  key={file.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectedFileId(file.id)}
                      className="mt-1 w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <FileText className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {file.filename}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                        <span>{(file.size_bytes / 1024).toFixed(1)} KB</span>
                        {file.total_pages && <span>{file.total_pages} pages</span>}
                        <span>{chunks} parent-child chunks</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-44">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          {status === "READY" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : status === "FAILED" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                          )}
                          {status}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            status === "READY"
                              ? "bg-emerald-500"
                              : status === "FAILED"
                              ? "bg-red-500"
                              : "bg-amber-400"
                          }`}
                          style={{ width: `${Math.max(5, progress)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Delete file and vectors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}