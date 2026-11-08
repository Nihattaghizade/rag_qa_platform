export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_V1_URL || "http://localhost:8000/api/v1";

export interface UserDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  max_files: number;
  max_questions: number;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  created_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserDTO;
}

export interface FileRecordDTO {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  progress_pct: number;
  total_pages: number | null;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkPreviewItemDTO {
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
  chunks: ChunkPreviewItemDTO[];
}

export interface CitationDTO {
  index: number;
  chunk_id: string;
  file_id: string;
  filename: string;
  page_number: number;
  section_heading: string | null;
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

export interface ChatSubmitResponseDTO {
  user_message_id: string;
  assistant_message_id: string;
  chat_id: string;
  status: string;
  stream_channel: string;
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
  recent_activity: Array<{
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
  }>;
}

export interface AdminUserSummaryDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
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

let refreshPromise: Promise<AuthTokenResponse | null> | null = null;

export async function trySilentRefresh(): Promise<AuthTokenResponse | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!resp.ok) return null;
      return (await resp.json()) as AuthTokenResponse;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const buildHeaders = (token?: string | null) => {
    const h = new Headers(options.headers || {});
    if (token) {
      h.set("Authorization", `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData) && !h.has("Content-Type")) {
      h.set("Content-Type", "application/json");
    }
    return h;
  };

  let resp = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(accessToken),
    credentials: "include",
  });

  if (
    resp.status === 401 &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register") &&
    !path.startsWith("/auth/refresh")
  ) {
    const refreshed = await trySilentRefresh();
    if (refreshed?.access_token) {
      if (typeof window !== "undefined") {
        const { useAppStore } = await import("@/store/useAppStore");
        useAppStore.getState().setAuth(refreshed.access_token, refreshed.user);
      }
      resp = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(refreshed.access_token),
        credentials: "include",
      });
    } else if (typeof window !== "undefined") {
      const { useAppStore } = await import("@/store/useAppStore");
      useAppStore.getState().clearAuth();
      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(errBody.detail || `HTTP ${resp.status}`);
  }

  return resp.json() as Promise<T>;
}