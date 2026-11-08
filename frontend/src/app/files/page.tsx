"use client";

import React, { useRef, useState } from "react";
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
  Eye,
  X,
  Hash,
  Database,
  Layers,
  Play,
} from "lucide-react";
import {
  API_BASE_URL,
  apiRequest,
  FileDetailedInspectionDTO,
  FileRecordDTO,
  UserUsageTelemetryDTO,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function FilesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeWorkersRef = useRef<Record<string, Worker>>({});

  const accessToken = useAppStore((s) => s.accessToken);
  const setNavigating = useAppStore((s) => s.setNavigating);
  const selectedFileIds = useAppStore((s) => s.selectedFileIds);
  const toggleSelectedFileId = useAppStore((s) => s.toggleSelectedFileId);
  const liveFileProgress = useAppStore((s) => s.liveFileProgress);
  const upsertFileProgress = useAppStore((s) => s.upsertFileProgress);
  const removeFileProgress = useAppStore((s) => s.removeFileProgress);

  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [inspectFileId, setInspectFileId] = useState<string | null>(null);

  const { data: files = [], isLoading } = useQuery<FileRecordDTO[]>({
    queryKey: ["files"],
    queryFn: () => apiRequest<FileRecordDTO[]>("/files", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 3500,
  });

  const { data: usage } = useQuery<UserUsageTelemetryDTO>({
    queryKey: ["my_usage"],
    queryFn: () =>
      apiRequest<UserUsageTelemetryDTO>("/users/me/usage", {}, accessToken),
    enabled: Boolean(accessToken),
    refetchInterval: 4000,
  });

  const { data: inspectedDetails, isLoading: loadingDetails } =
    useQuery<FileDetailedInspectionDTO>({
      queryKey: ["file_details", inspectFileId],
      queryFn: () =>
        apiRequest<FileDetailedInspectionDTO>(
          `/files/${inspectFileId}/details`,
          {},
          accessToken
        ),
      enabled: Boolean(accessToken && inspectFileId),
    });

  const maxFiles = usage?.max_files ?? 3;
  const filesUsed = files.length;
  const quotaReached = filesUsed >= maxFiles;

  const handleSelectFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setUploadError(null);
    const incoming = Array.from(fileList);

    if (filesUsed + stagedFiles.length + incoming.length > maxFiles) {
      setUploadError(
        `Cannot stage ${incoming.length} file(s): your quota is ${maxFiles} files (${filesUsed} already uploaded, ${stagedFiles.length} staged).`
      );
      return;
    }

    setStagedFiles((prev) => [...prev, ...incoming]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveStaged = (idx: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStartUpload = () => {
    if (!accessToken || stagedFiles.length === 0) return;
    setUploadError(null);
    setIsUploadingBatch(true);

    const filesToUpload = [...stagedFiles];
    setStagedFiles([]);

    let remaining = filesToUpload.length;

    filesToUpload.forEach((file) => {
      const tempJobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const worker = new Worker("/upload-worker.js");
      activeWorkersRef.current[tempJobId] = worker;

      worker.onmessage = (event) => {
        const { fileRecord, status, progress, error } = event.data;
        if (status === "FAILED" || error) {
          setUploadError(error || `Upload failed for ${file.name}`);
          worker.terminate();
          delete activeWorkersRef.current[tempJobId];
          remaining -= 1;
          if (remaining <= 0) setIsUploadingBatch(false);
          return;
        }
        if (fileRecord?.id) {
          activeWorkersRef.current[fileRecord.id] = worker;
          delete activeWorkersRef.current[tempJobId];
          upsertFileProgress({
            file_id: fileRecord.id,
            filename: file.name,
            status: status || fileRecord.status,
            progress_pct: progress || fileRecord.progress_pct,
            total_chunks: fileRecord.total_chunks || 0,
          });
          queryClient.invalidateQueries({ queryKey: ["files"] });
          queryClient.invalidateQueries({ queryKey: ["my_usage"] });
          worker.terminate();
          delete activeWorkersRef.current[fileRecord.id];
          remaining -= 1;
          if (remaining <= 0) setIsUploadingBatch(false);
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

    if (activeWorkersRef.current[fileId]) {
      activeWorkersRef.current[fileId].terminate();
      delete activeWorkersRef.current[fileId];
    }

    removeFileProgress(fileId);
    await apiRequest(`/files/${fileId}`, { method: "DELETE" }, accessToken);
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["my_usage"] });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tenant Document Repository
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select PDF or DOCX files, review your staged queue, and click Start Upload &amp; Indexing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center gap-3">
            <div>
              <span className="text-slate-500 dark:text-slate-400">File Quota: </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {filesUsed} / {maxFiles}
              </span>
            </div>
            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  quotaReached ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, (filesUsed / Math.max(1, maxFiles)) * 100)}%`,
                }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              setNavigating(true);
              router.push("/chat");
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 shadow-md shadow-emerald-600/20 transition"
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
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div
          onClick={() => {
            if (!quotaReached) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
            quotaReached
              ? "border-amber-500/40 bg-amber-500/5 cursor-not-allowed"
              : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 bg-slate-50/60 dark:bg-slate-950/50 cursor-pointer"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => handleSelectFiles(e.target.files)}
          />
          <UploadCloud
            className={`w-10 h-10 mx-auto mb-3 ${
              quotaReached ? "text-amber-500" : "text-emerald-500"
            }`}
          />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {quotaReached
              ? `File Upload Limit Reached (${filesUsed}/${maxFiles} files)`
              : "Step 1: Click to Choose PDF or DOCX Files"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Chosen files are staged below. Processing starts only when you click &ldquo;Start Upload &amp; Indexing&rdquo;.
          </p>
        </div>

        {stagedFiles.length > 0 && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Staged Files Ready to Upload ({stagedFiles.length})
              </span>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isUploadingBatch}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2 shadow-md transition"
              >
                {isUploadingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Step 2: Start Upload &amp; Indexing</span>
              </button>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {stagedFiles.map((sf, idx) => (
                <div
                  key={`${sf.name}_${idx}`}
                  className="py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {sf.name}
                    </span>
                    <span className="text-slate-400">
                      ({(sf.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStaged(idx)}
                    className="text-slate-400 hover:text-red-500 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Uploaded &amp; Active Documents ({files.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Deleting an active file immediately stops background parsing/embedding
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No documents uploaded yet. Choose a file above and click Start Upload.
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
                  className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectedFileId(file.id)}
                      className="mt-1 w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <FileText className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{file.filename}</span>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                          {file.mime_type.includes("pdf") ? "PDF" : "DOCX"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                        <span>{(file.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{file.total_pages ?? 1} page(s)</span>
                        <span>•</span>
                        <span>{chunks} hierarchical chunks</span>
                        <span>•</span>
                        <span className="font-mono text-[11px]">
                          SHA256: {file.content_sha256.slice(0, 12)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-40">
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
                      onClick={() => setInspectFileId(file.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Inspect</span>
                    </button>

                    <button
                      onClick={() => handleDelete(file.id)}
                      className="px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Stop process & soft-delete file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {status !== "READY" && status !== "FAILED"
                          ? "Stop & Delete"
                          : "Delete"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {inspectFileId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Document Technical Inspection &amp; Extracted Chunks
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectedDetails?.file.filename || "Loading metadata..."}
                </p>
              </div>
              <button
                onClick={() => setInspectFileId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetails || !inspectedDetails ? (
                <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading file metadata and chunks...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 flex items-center gap-1.5 mb-1">
                        <Hash className="w-3.5 h-3.5 text-emerald-500" />
                        <span>SHA-256 Content Fingerprint</span>
                      </div>
                      <div className="font-mono text-[11px] break-all text-slate-800 dark:text-slate-200">
                        {inspectedDetails.file.content_sha256}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 flex items-center gap-1.5 mb-1">
                        <Database className="w-3.5 h-3.5 text-emerald-500" />
                        <span>MinIO S3 Object Key</span>
                      </div>
                      <div className="font-mono text-[11px] break-all text-slate-800 dark:text-slate-200">
                        {inspectedDetails.file.s3_key}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-slate-500 flex items-center gap-1.5 mb-1">
                        <Layers className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Extraction Metrics</span>
                      </div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {inspectedDetails.file.total_pages ?? 1} Pages •{" "}
                        {inspectedDetails.file.total_chunks} Indexed Chunks
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Uploaded:{" "}
                        {new Date(inspectedDetails.file.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Parent-Child Semantic Chunks ({inspectedDetails.chunks.length})
                    </h4>
                    {inspectedDetails.chunks.map((ch) => (
                      <div
                        key={ch.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Chunk #{ch.chunk_index + 1} • Page {ch.page_number}
                          </span>
                          <span className="text-slate-500">
                            Section: {ch.section_heading || "Overview"} • ~{ch.token_count} tokens
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {ch.parent_text}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}