# 部署指南

## 1. 准备工作

### 创建Supabase项目
1. 访问 https://supabase.com
2. 创建新项目（选择离你最近的地区）
3. 等待项目初始化完成（约2分钟）

### 获取Supabase凭证
1. 进入项目设置 → API
2. 复制 `Project URL`（你的SUPABASE_URL）
3. 复制 `anon public key`（你的SUPABASE_ANON_KEY）

---

## 2. 配置Supabase数据库

### 执行SQL脚本
1. 在Supabase控制台，进入 **SQL Editor**
2. 创建新查询，粘贴 `supabase/schema.sql` 的全部内容
3. 点击 **Run** 执行

这将创建：
- `documents` 表（存储文档元数据）
- `document_chunks` 表（存储文本块和向量）
- `conversations` 和 `messages` 表（存储对话历史）
- `user_settings` 表（存储用户配置）
- `match_documents` 函数（相似度搜索）

### 配置Storage Bucket
1. 进入 **Storage**
2. 创建新bucket：`documents`
3. 设置为 **Public** 或配置RLS策略：

```sql
-- 允许认证用户上传
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'documents');

-- 允许所有人读取
create policy "Allow public access"
on storage.objects for select
to public
using (bucket_id = 'documents');
```

---

## 3. 本地开发测试

### 安装依赖
```bash
npm install
```

### 配置环境变量
创建 `.env.local` 文件（已在.gitignore中）：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 启动本地服务器
```bash
npm run dev
```

访问 http://localhost:8080

### 测试功能
1. 打开浏览器控制台（F12）
2. 在设置中输入Supabase凭证
3. 尝试上传一个.txt文件
4. 检查Supabase控制台的 `documents` 表是否有数据

---

## 4. 部署到Cloudflare Pages

### 方法A：通过Cloudflare Dashboard（推荐，最简单）

1. **连接GitHub仓库**
   - 登录 https://dash.cloudflare.com
   - 进入 **Workers & Pages**
   - 点击 **Create application** → **Pages** → **Connect to Git**
   - 授权并选择 `ucl-mpa-esg` 仓库

2. **配置构建设置**
   ```
   Framework preset: None
   Build command: (留空)
   Build output directory: /
   Root directory: /
   ```

3. **添加环境变量**
   - 在部署设置中，添加：
     - `SUPABASE_URL`: 你的Supabase URL
     - `SUPABASE_ANON_KEY`: 你的匿名密钥

4. **部署**
   - 点击 **Save and Deploy**
   - 等待部署完成（约1-2分钟）
   - 获得部署URL：`https://ucl-mpa-esg.pages.dev`

5. **自动部署**
   - 之后每次推送到GitHub main分支，Cloudflare会自动重新部署

### 方法B：使用Wrangler CLI

1. **安装Wrangler**
```bash
npm install -g wrangler
```

2. **登录Cloudflare**
```bash
wrangler login
```

3. **部署**
```bash
npm run deploy
```

4. **设置环境变量**
```bash
wrangler pages secret put SUPABASE_URL
wrangler pages secret put SUPABASE_ANON_KEY
```

---

## 5. 配置AI API密钥（用户端）

部署完成后，用户需要在页面设置中配置：

### OpenAI GPT
- API Key: 从 https://platform.openai.com/api-keys 获取
- Base URL: `https://api.openai.com/v1`（默认）
- 模型: `gpt-4o` 或 `gpt-4o-mini`

### DeepSeek
- API Key: 从 https://platform.deepseek.com 获取
- Base URL: `https://api.deepseek.com/v1`
- 模型: `deepseek-chat`

### Google Gemini
- API Key: 从 https://makersuite.google.com/app/apikey 获取
- Base URL: `https://generativelanguage.googleapis.com/v1beta`
- 模型: `gemini-2.0-flash-exp`

---

## 6. 验证部署

### 检查清单
- [ ] 页面可以正常访问
- [ ] 在设置中输入Supabase凭证后，显示"连接成功"
- [ ] 可以创建文件夹
- [ ] 可以上传 .txt 文件并解析
- [ ] 可以上传 .docx 文件并解析
- [ ] 可以上传 .pdf 文件并解析
- [ ] 在聊天室输入问题，AI能正确响应
- [ ] 对话历史被保存到Supabase

### 常见问题

**Q: CORS错误？**
A: 确保Supabase项目的API设置中允许你的域名，或使用anon key（已自动处理CORS）

**Q: 文件上传失败？**
A: 检查Storage bucket权限，确保已创建RLS策略

**Q: 向量搜索不工作？**
A: 确保已执行schema.sql，检查pgvector扩展是否启用：
```sql
select * from pg_extension where extname = 'vector';
```

**Q: AI回复慢？**
A: 正常现象，GPT-4o需要3-10秒，可以添加流式响应优化

---

## 7. 后续优化（可选）

### 添加Edge Function处理大文件
对于大型PDF/PPT文件，可以创建Supabase Edge Function：

```bash
supabase functions new parse-document
```

### 启用Supabase Auth
如果需要多用户支持：
```bash
# 在schema.sql中取消注释RLS策略
# 在前端添加登录逻辑
```

### 添加Embedding自动化
使用Supabase Webhooks + Edge Functions自动生成向量：
```javascript
// supabase/functions/generate-embedding/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { record } = await req.json()
  // 调用OpenAI Embeddings API
  // 更新document_chunks表
})
```

---

## 8. 成本估算

### Supabase（免费版）
- 存储: 500MB（足够存储数千份文档）
- 数据库: 无限行
- 带宽: 5GB/月

### Cloudflare Pages（免费版）
- 带宽: 无限
- 请求: 100,000次/天
- 构建: 500次/月

### AI API（按需付费）
- OpenAI GPT-4o: ~$0.005/1K tokens
- DeepSeek: ~$0.0002/1K tokens（便宜25倍）
- Gemini 2.0: 免费（有配额限制）

**预估月成本：** $0-5（个人使用，以DeepSeek为主）

---

完成！🎉 现在你有一个完全免费（或低成本）、可扩展的学术助手系统。
