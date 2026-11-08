CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS message_feedback CASCADE;
DROP TABLE IF EXISTS ragas_evaluations CASCADE;
DROP TABLE IF EXISTS audit_token_ledger CASCADE;
DROP TABLE IF EXISTS document_parent_chunks CASCADE;
DROP TABLE IF EXISTS file_ingestion_jobs CASCADE;
DROP TABLE IF EXISTS user_files CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    device_info VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(512) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    s3_bucket VARCHAR(128) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    content_sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'INITIATED',
    progress_pct INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER,
    total_chunks INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_files_user_sha256 UNIQUE (user_id, content_sha256)
);

CREATE INDEX idx_files_user_id ON files(user_id);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    section_heading VARCHAR(512),
    parent_text TEXT NOT NULL,
    child_text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_file_chunk_idx UNIQUE (file_id, chunk_index)
);

CREATE INDEX idx_document_chunks_file_id ON document_chunks(file_id);
CREATE INDEX idx_document_chunks_user_id ON document_chunks(user_id);

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    rolling_summary TEXT,
    scoped_file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
    query_mode VARCHAR(32),
    rewritten_query TEXT,
    content TEXT NOT NULL DEFAULT '',
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_files_tenant ON files
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rls_document_chunks_tenant ON document_chunks
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rls_chat_sessions_tenant ON chat_sessions
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rls_chat_messages_tenant ON chat_messages
    USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);














-- -- ============================================================================
-- -- ENTERPRISE PRODUCTION RAG — COMPLETE POSTGRESQL 17 SCHEMA & RLS
-- -- ============================================================================
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -- ENUM TYPES
-- CREATE TYPE user_role AS ENUM ('admin', 'member', 'viewer');
-- CREATE TYPE file_status AS ENUM ('UPLOADING', 'QUEUED', 'PARSING', 'CHUNKING', 'EMBEDDING', 'READY', 'FAILED', 'DELETING');
-- CREATE TYPE fusion_mode AS ENUM ('auto_router', 'rrf', 'weighted_sum');
-- CREATE TYPE msg_role AS ENUM ('user', 'assistant', 'system');
-- CREATE TYPE msg_status AS ENUM ('QUEUED', 'RETRIEVING', 'RERANKING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- -- 1. TENANTS
-- CREATE TABLE tenants (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     slug VARCHAR(128) UNIQUE NOT NULL,
--     plan_tier VARCHAR(64) NOT NULL DEFAULT 'enterprise',
--     max_storage_bytes BIGINT NOT NULL DEFAULT 107374182400,
--     max_files_per_user INT NOT NULL DEFAULT 1000,
--     rate_limit_rpm INT NOT NULL DEFAULT 60,
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 2. USERS
-- CREATE TABLE users (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
--     email VARCHAR(255) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     full_name VARCHAR(255) NOT NULL,
--     role user_role NOT NULL DEFAULT 'member',
--     preferred_language VARCHAR(16) NOT NULL DEFAULT 'az',
--     storage_used_bytes BIGINT NOT NULL DEFAULT 0,
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     last_login_at TIMESTAMPTZ,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 3. USER_SESSIONS
-- CREATE TABLE user_sessions (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     refresh_token_hash CHAR(64) UNIQUE NOT NULL,
--     user_agent TEXT,
--     ip_address INET,
--     expires_at TIMESTAMPTZ NOT NULL,
--     revoked_at TIMESTAMPTZ,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 4. USER_FILES
-- CREATE TABLE user_files (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
--     filename VARCHAR(512) NOT NULL,
--     original_extension VARCHAR(16) NOT NULL CHECK (original_extension IN ('pdf', 'docx')),
--     mime_type VARCHAR(128) NOT NULL,
--     s3_bucket VARCHAR(128) NOT NULL DEFAULT 'enterprise-rag-docs',
--     s3_key VARCHAR(1024) UNIQUE NOT NULL,
--     file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
--     content_sha256 CHAR(64) NOT NULL,
--     status file_status NOT NULL DEFAULT 'UPLOADING',
--     progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
--     page_count INT NOT NULL DEFAULT 0,
--     parent_chunk_count INT NOT NULL DEFAULT 0,
--     child_chunk_count INT NOT NULL DEFAULT 0,
--     error_code VARCHAR(64),
--     error_message TEXT,
--     doc_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
--     is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 5. FILE_INGESTION_JOBS
-- CREATE TABLE file_ingestion_jobs (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     file_id UUID NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     kafka_topic VARCHAR(128) NOT NULL DEFAULT 'doc.uploaded',
--     kafka_partition INT,
--     kafka_offset BIGINT,
--     celery_task_id VARCHAR(128),
--     current_stage file_status NOT NULL DEFAULT 'QUEUED',
--     attempt_number SMALLINT NOT NULL DEFAULT 1,
--     max_attempts SMALLINT NOT NULL DEFAULT 3,
--     parse_duration_ms INT,
--     chunk_duration_ms INT,
--     embed_duration_ms INT,
--     cached_embeddings_count INT NOT NULL DEFAULT 0,
--     computed_embeddings_count INT NOT NULL DEFAULT 0,
--     stage_checkpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
--     last_error TEXT,
--     started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     completed_at TIMESTAMPTZ,
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 6. DOCUMENT_PARENT_CHUNKS
-- CREATE TABLE document_parent_chunks (
--     id UUID PRIMARY KEY,
--     file_id UUID NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     parent_index INT NOT NULL,
--     page_start INT NOT NULL DEFAULT 1,
--     page_end INT NOT NULL DEFAULT 1,
--     section_heading VARCHAR(512),
--     content_markdown TEXT NOT NULL,
--     token_count INT NOT NULL,
--     content_sha256 CHAR(64) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     UNIQUE (file_id, parent_index)
-- );

-- -- 7. CHAT_SESSIONS
-- CREATE TABLE chat_sessions (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
--     title VARCHAR(255) NOT NULL DEFAULT 'New Document Chat',
--     scoped_file_ids UUID[] NOT NULL DEFAULT '{}',
--     fusion_strategy fusion_mode NOT NULL DEFAULT 'auto_router',
--     dense_weight_alpha NUMERIC(3,2) NOT NULL DEFAULT 0.70 CHECK (dense_weight_alpha BETWEEN 0.00 AND 1.00),
--     top_k_final SMALLINT NOT NULL DEFAULT 6 CHECK (top_k_final BETWEEN 1 AND 20),
--     summary_memory TEXT,
--     message_count INT NOT NULL DEFAULT 0,
--     is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
--     is_archived BOOLEAN NOT NULL DEFAULT FALSE,
--     last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 8. CHAT_MESSAGES
-- CREATE TABLE chat_messages (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     parent_user_msg_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
--     role msg_role NOT NULL,
--     status msg_status NOT NULL DEFAULT 'COMPLETED',
--     content TEXT NOT NULL DEFAULT '',
--     condensed_query TEXT,
--     detected_intent VARCHAR(64),
--     fusion_used VARCHAR(32),
--     citations JSONB NOT NULL DEFAULT '[]'::jsonb,
--     token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
--     retrieval_latency_ms INT,
--     rerank_latency_ms INT,
--     ttft_ms INT,
--     total_latency_ms INT,
--     cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
--     error_message TEXT,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 9. MESSAGE_FEEDBACK & RAGAS_EVALUATIONS
-- CREATE TABLE message_feedback (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     message_id UUID UNIQUE NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
--     comment TEXT,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- CREATE TABLE ragas_evaluations (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     message_id UUID UNIQUE NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     faithfulness_score NUMERIC(4,3),
--     context_precision_score NUMERIC(4,3),
--     context_recall_score NUMERIC(4,3),
--     answer_relevancy_score NUMERIC(4,3),
--     evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- 10. AUDIT_TOKEN_LEDGER
-- CREATE TABLE audit_token_ledger (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
--     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
--     action_type VARCHAR(64) NOT NULL,
--     model_name VARCHAR(64),
--     prompt_tokens INT NOT NULL DEFAULT 0,
--     cached_tokens INT NOT NULL DEFAULT 0,
--     completion_tokens INT NOT NULL DEFAULT 0,
--     estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ROW-LEVEL SECURITY (RLS)
-- ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE file_ingestion_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE document_parent_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY rls_user_files ON user_files
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- CREATE POLICY rls_ingestion_jobs ON file_ingestion_jobs
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- CREATE POLICY rls_parent_chunks ON document_parent_chunks
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- CREATE POLICY rls_chat_sessions ON chat_sessions
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- CREATE POLICY rls_chat_messages ON chat_messages
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- CREATE POLICY rls_message_feedback ON message_feedback
--     USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- -- INDEXES
-- CREATE INDEX idx_user_files_user_ready ON user_files(user_id, status, is_deleted, created_at DESC);
-- CREATE INDEX idx_user_files_sha256 ON user_files(user_id, content_sha256) WHERE is_deleted = FALSE;
-- CREATE INDEX idx_parent_chunks_file ON document_parent_chunks(file_id, parent_index);
-- CREATE INDEX idx_chat_sessions_user_list ON chat_sessions(user_id, is_archived, is_pinned DESC, last_message_at DESC);
-- CREATE INDEX idx_chat_messages_session_history ON chat_messages(session_id, created_at ASC);
-- CREATE INDEX idx_chat_messages_active_gen ON chat_messages(user_id, status) WHERE status IN ('QUEUED', 'RETRIEVING', 'RERANKING', 'GENERATING');
-- CREATE INDEX idx_audit_ledger_user_date ON audit_token_ledger(user_id, created_at DESC);

-- -- DEFAULT TENANT SEED
-- INSERT INTO tenants (id, name, slug, plan_tier)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Default Enterprise Organization', 'default-enterprise', 'enterprise')
-- ON CONFLICT (slug) DO NOTHING;
