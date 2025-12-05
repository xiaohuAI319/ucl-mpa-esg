# UCL MPA ESG 学术助手

基于个人知识库的AI学术助手，支持多格式文档上传，使用RAG技术进行智能问答。

## 🎯 功能特性

### 核心功能
- ✅ **多格式支持**: TXT, MD, DOCX, PDF, PPTX
- ✅ **云端存储**: 基于 Supabase Storage + PostgreSQL
- ✅ **向量搜索**: 使用 pgvector 实现语义检索
- ✅ **多AI模型**: 支持 GPT-4o / DeepSeek / Gemini
- ✅ **实时同步**: 跨设备访问知识库

### 技术栈
- **前端**: HTML + Tailwind CSS + Vanilla JS
- **部署**: Cloudflare Pages
- **数据库**: Supabase PostgreSQL + pgvector
- **文件存储**: Supabase Storage
- **AI**: OpenAI / DeepSeek / Gemini API

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/xiaohuAI319/ucl-mpa-esg.git
cd ucl-mpa-esg
```

### 2. 配置 Supabase

#### 创建 Supabase 项目
1. 访问 [supabase.com](https://supabase.com)
2. 创建新项目
3. 获取 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`

#### 执行数据库迁移
在 Supabase SQL Editor 中执行 `supabase/schema.sql`

#### 配置 Storage Bucket
```sql
-- 创建存储桶
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', false);

-- 设置访问策略
create policy "用户可以上传文件"
on storage.objects for insert
to authenticated
with check (bucket_id = 'documents');

create policy "用户可以查看自己的文件"
on storage.objects for select
to authenticated
using (bucket_id = 'documents');
```

### 3. 配置前端
编辑 `index.html`，填入你的配置：
```javascript
const SUPABASE_URL = 'your-project-url.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 4. 部署到 Cloudflare Pages

#### 通过 GitHub 部署（推荐）
1. 将代码推送到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. 进入 Pages → Create a project
4. 连接 GitHub 仓库 `ucl-mpa-esg`
5. 配置构建设置：
   - Build command: 留空（纯静态）
   - Build output directory: `/`
6. 点击 Deploy

#### 通过 Wrangler CLI 部署
```bash
npm install -g wrangler
wrangler pages deploy . --project-name=ucl-mpa-esg
```

### 5. 配置 AI API
在应用设置中填入：
- OpenAI API Key
- DeepSeek API Key
- Gemini API Key

## 📁 项目结构

```
ucl-mpa-esg/
├── index.html              # 主页面
├── supabase/
│   ├── schema.sql          # 数据库结构
│   └── functions/          # Edge Functions（可选）
│       └── parse-document/ # 文档解析函数
├── styles/
│   └── custom.css          # 自定义样式（可选）
├── js/
│   ├── supabase-client.js  # Supabase 客户端
│   ├── file-handler.js     # 文件处理
│   └── ai-chat.js          # AI 对话
└── README.md               # 本文件
```

## 💾 数据库结构

### documents 表
```sql
- id: bigserial primary key
- user_id: uuid (references auth.users)
- folder_name: text
- file_name: text
- file_type: text (pdf, docx, txt, etc)
- storage_path: text
- content: text
- embedding: vector(1536)
- metadata: jsonb
- created_at: timestamp
```

### folders 表
```sql
- id: bigserial primary key
- user_id: uuid
- name: text
- created_at: timestamp
```

## 🔧 高级配置

### 自定义 Embedding 模型
默认使用 OpenAI `text-embedding-3-small`，可以修改为：
- OpenAI `text-embedding-3-large` (3072维)
- Cohere `embed-multilingual-v3.0`
- 本地模型（需要 Edge Function）

### 文档解析
- **TXT/MD**: 前端直接读取
- **DOCX**: mammoth.js (前端)
- **PDF**: pdf.js 或 Supabase Edge Function
- **PPT**: Supabase Edge Function + python-pptx

## 📖 使用说明

### 1. 上传文档
- 创建文件夹
- 拖拽或选择文件上传
- 系统自动解析并向量化

### 2. AI 对话
- 选择 AI 模型
- 输入问题
- 系统自动检索相关文档
- 生成学术风格回答

### 3. 自定义提示词
- 在设置中编辑 System Prompt
- 可保存多个模板

## 🛡️ 安全说明

- ⚠️ 不要提交 API Keys 到代码库
- ⚠️ 使用环境变量管理敏感信息
- ⚠️ Supabase RLS 确保数据隔离
- ⚠️ 仅个人使用，不要分享 API Keys

## 📝 开发计划

- [ ] 添加 PPT 解析支持
- [ ] 优化向量搜索性能
- [ ] 添加对话历史管理
- [ ] 支持网络搜索增强
- [ ] 多语言界面
- [ ] 移动端适配

## 📄 License

MIT License

## 👤 作者

xiaohuAI319

---

**欢迎 Star ⭐ 和 Fork 🍴**
