-- ============================================
-- UCL MPA ESG 学术助手 - Supabase 数据库结构
-- ============================================

-- 1. 启用必要的扩展
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- 2. 创建文件夹表
create table if not exists folders (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 创建文档表
create table if not exists documents (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  folder_id bigint references folders(id) on delete cascade,
  file_name text not null,
  file_type text not null, -- txt, md, pdf, docx, pptx
  file_size bigint,
  storage_path text, -- Supabase Storage 路径
  content text, -- 解析后的文本内容
  embedding vector(1536), -- OpenAI text-embedding-3-small
  metadata jsonb default '{}'::jsonb, -- 额外元数据
  parse_status text default 'pending', -- pending, processing, success, failed
  parse_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. 创建文本块表（用于RAG检索）
create table if not exists document_chunks (
  id bigserial primary key,
  document_id bigint references documents(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(1536),
  token_count integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. 创建对话历史表
create table if not exists conversations (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  model text, -- gpt-4o, deepseek-chat, gemini-2.0-flash-exp
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. 创建消息表
create table if not exists messages (
  id bigserial primary key,
  conversation_id bigint references conversations(id) on delete cascade,
  role text not null, -- user, assistant, system
  content text not null,
  sources jsonb default '[]'::jsonb, -- 引用的文档信息
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. 创建用户配置表
create table if not exists user_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  system_prompt text,
  default_model text default 'gpt-4o',
  search_enabled boolean default false,
  api_keys jsonb default '{}'::jsonb, -- 加密存储 API keys（仅用于记录，实际应在前端管理）
  preferences jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- 索引优化
-- ============================================

-- 文档查询索引
create index if not exists idx_documents_user_id on documents(user_id);
create index if not exists idx_documents_folder_id on documents(folder_id);
create index if not exists idx_documents_parse_status on documents(parse_status);

-- 向量搜索索引（使用 IVFFlat）
create index if not exists idx_documents_embedding on documents 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists idx_chunks_embedding on document_chunks 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 对话历史索引
create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_messages_conversation_id on messages(conversation_id);

-- 文件夹索引
create index if not exists idx_folders_user_id on folders(user_id);

-- ============================================
-- RLS (Row Level Security) 安全策略
-- ============================================

-- 启用 RLS
alter table folders enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table user_configs enable row level security;

-- Folders 策略
create policy "用户只能查看自己的文件夹"
  on folders for select
  using (auth.uid() = user_id);

create policy "用户可以创建文件夹"
  on folders for insert
  with check (auth.uid() = user_id);

create policy "用户可以更新自己的文件夹"
  on folders for update
  using (auth.uid() = user_id);

create policy "用户可以删除自己的文件夹"
  on folders for delete
  using (auth.uid() = user_id);

-- Documents 策略
create policy "用户只能查看自己的文档"
  on documents for select
  using (auth.uid() = user_id);

create policy "用户可以上传文档"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "用户可以更新自己的文档"
  on documents for update
  using (auth.uid() = user_id);

create policy "用户可以删除自己的文档"
  on documents for delete
  using (auth.uid() = user_id);

-- Document Chunks 策略（通过 documents 表关联）
create policy "用户可以查看自己文档的块"
  on document_chunks for select
  using (
    exists (
      select 1 from documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

create policy "用户可以创建文档块"
  on document_chunks for insert
  with check (
    exists (
      select 1 from documents
      where documents.id = document_chunks.document_id
      and documents.user_id = auth.uid()
    )
  );

-- Conversations 策略
create policy "用户只能查看自己的对话"
  on conversations for select
  using (auth.uid() = user_id);

create policy "用户可以创建对话"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "用户可以更新自己的对话"
  on conversations for update
  using (auth.uid() = user_id);

create policy "用户可以删除自己的对话"
  on conversations for delete
  using (auth.uid() = user_id);

-- Messages 策略
create policy "用户可以查看自己对话的消息"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "用户可以创建消息"
  on messages for insert
  with check (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- User Configs 策略
create policy "用户只能查看自己的配置"
  on user_configs for select
  using (auth.uid() = user_id);

create policy "用户可以创建配置"
  on user_configs for insert
  with check (auth.uid() = user_id);

create policy "用户可以更新自己的配置"
  on user_configs for update
  using (auth.uid() = user_id);

-- ============================================
-- 辅助函数
-- ============================================

-- 1. 向量相似度搜索函数（搜索文档）
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_user_id uuid default null
)
returns table (
  id bigint,
  file_name text,
  content text,
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  select
    documents.id,
    documents.file_name,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity,
    documents.metadata
  from documents
  where 
    documents.embedding is not null
    and (filter_user_id is null or documents.user_id = filter_user_id)
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

-- 2. 向量相似度搜索函数（搜索文本块）
create or replace function match_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 20,
  filter_user_id uuid default null
)
returns table (
  id bigint,
  document_id bigint,
  file_name text,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    documents.file_name,
    document_chunks.chunk_text,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  join documents on documents.id = document_chunks.document_id
  where 
    document_chunks.embedding is not null
    and (filter_user_id is null or documents.user_id = filter_user_id)
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 3. 更新时间戳触发器函数
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- 4. 为所有表添加更新时间戳触发器
create trigger update_folders_updated_at before update on folders
  for each row execute function update_updated_at_column();

create trigger update_documents_updated_at before update on documents
  for each row execute function update_updated_at_column();

create trigger update_conversations_updated_at before update on conversations
  for each row execute function update_updated_at_column();

create trigger update_user_configs_updated_at before update on user_configs
  for each row execute function update_updated_at_column();

-- ============================================
-- Storage 配置（需要在 Supabase Dashboard 执行）
-- ============================================

-- 创建 documents bucket（在 Supabase Dashboard 的 Storage 部分执行）
-- insert into storage.buckets (id, name, public) 
-- values ('documents', 'documents', false);

-- Storage RLS 策略
create policy "用户可以上传自己的文件"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "用户可以查看自己的文件"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "用户可以更新自己的文件"
on storage.objects for update
to authenticated
using (
  bucket_id = 'documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "用户可以删除自己的文件"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 初始化完成
-- ============================================
-- 执行此脚本后，你的 Supabase 项目已准备就绪！
