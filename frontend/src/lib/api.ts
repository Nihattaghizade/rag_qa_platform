export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface UserDTO {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  max_files: number;
  max_questions: number;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  created_at: string;
}

export interface UserUsageTelemetryDTO {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  files_used: number;
  max_files: number;
  questions_used: number;
  max_questions: number;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  total_chat_sessions: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  avg_latency_ms: number;
  recent_activity: {
    id: string;
    status: string;
    query_mode: string;
    rewritten_query: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    latency_ms: number | null;
    citations_count: number;
    created_at: string;
  }[];
}

export interface AdminUserSummaryDTO {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_active: boolean;
  files_used: number;
  max_files: number;
  questions_used: number;
  max_questions: number;
  total_chunks: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  storage_used_bytes: number;
  created_at: string;
}

export interface AdminDashboardOverviewDTO {
  total_users: number;
  total_files: number;
  total_chunks: number;
  total_questions_asked: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  users: AdminUserSummaryDTO[];
}

export interface FileRecordDTO {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  s3_bucket: string;
  s3_key: string;
  content_sha256: string;
  status: string;
  progress_pct: number;
  total_pages: number | null;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkPreviewDTO {
  id: string;
  chunk_index: number;
  page_number: number;
  section_heading: string | null;
  token_count: number;
  parent_text: string;
  child_text: string;
}

export interface FileDetailedInspectionDTO {
  file: FileRecordDTO;
  chunks: ChunkPreviewDTO[];
}

export interface CitationDTO {
  index: number;
  chunk_id: string;
  file_id: string;
  filename: string;
  page_number: number;
  section_heading?: string | null;
  rerank_score: number;
  excerpt: string;
}

export interface ChatSessionDTO {
  id: string;
  title: string;
  rolling_summary: string | null;
  scoped_file_ids: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageDTO {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  status: string;
  query_mode: string | null;
  rewritten_query: string | null;
  content: string;
  citations: CitationDTO[];
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number | null;
  created_at: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}