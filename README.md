# UCL MPA ESG Academic Assistant 🎓🐻

超可爱的学术助手！基于 **Supabase + Cloudflare Pages + React + TypeScript** 打造的个人知识库 RAG 系统

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6)

---

## ✨ 特性

### 🎨 **可爱的 UI 设计**
- 🐻 萌系 Kawaii 风格界面
- 🌈 温暖的配色方案（cream, peach, lavender）
- ✨ 流畅的动画和交互
- 📱 完全响应式设计

### 📚 **强大的知识库**
- 📤 支持多种格式：`.txt`, `.md`, `.docx`, `.pdf` (即将支持 `.pptx`)
- 📁 文件夹分类管理
- ☁️ Supabase 云端存储（500MB 免费空间）
- 🔍 RAG 智能检索

### 🤖 **多 AI 模型支持**
- **OpenAI GPT-4o** - 高质量学术分析
- **DeepSeek** - 性价比之王（便宜 25 倍）
- **Google Gemini** - 免费配额充足
- 🌐 可选网络搜索增强

### 🚀 **现代化部署**
- **Cloudflare Pages** - 全球 CDN，自动部署
- **Supabase** - PostgreSQL + Storage + Realtime
- **完全无服务器** - 零运维成本

---

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/xiaohuAI319/ucl-mpa-esg.git
cd ucl-mpa-esg
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 Supabase

1. 创建 Supabase 项目：https://supabase.com
2. 执行 `supabase/schema.sql` 中的 SQL
3. 创建 Storage bucket：`documents`

### 4. 本地开发

```bash
npm run dev
```

访问 http://localhost:3000

在设置中配置：
- Supabase URL 和 Anon Key
- AI API Keys（至少配置一个）

### 5. 部署到 Cloudflare Pages

#### 方法 A：通过 Dashboard（推荐）

1. 访问 https://dash.cloudflare.com
2. **Workers & Pages** → **Create application** → **Pages**
3. 连接 GitHub 仓库
4. 构建设置：
   ```
   Build command: npm run build
   Build output directory: dist
   ```
5. 添加环境变量（可选）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### 方法 B：使用 Wrangler CLI

```bash
npm run build
npm run deploy
```

---

## 📖 使用指南

### 📚 知识库管理

1. **创建文件夹**
   - 输入名称（如 "Week 1 - Policy Analysis"）
   - 点击 `+` 按钮

2. **上传文件**
   - 点击文件夹的 "Add Notes" 按钮
   - 选择文件或拖拽上传
   - 支持批量上传

3. **文件解析**
   - `.txt`, `.md` - 直接读取
   - `.docx` - mammoth.js 解析
   - `.pdf` - 标记已上传（完整解析即将支持）

### 💬 AI 聊天

1. **选择模型**
   - 右上角下拉框选择 AI 模型
   - 建议：日常用 DeepSeek，重要分析用 GPT-4o

2. **提问技巧**
   - ✅ "总结我的笔记中关于 ESG 的内容"
   - ✅ "公共政策分析的主要框架是什么？"
   - ❌ "讲讲 ESG"（太宽泛）

3. **网络搜索**
   - 开启后，AI 会搜索学术数据库
   - 仅 Gemini 支持此功能

### ⚙️ 设置配置

#### Supabase
```
URL: https://xxx.supabase.co
Anon Key: eyJhbGci...
```

#### OpenAI
```
Base URL: https://api.openai.com/v1/chat/completions
Model: gpt-4o-mini
API Key: sk-proj-...
```

#### DeepSeek
```
Base URL: https://api.deepseek.com/chat/completions
Model: deepseek-chat
API Key: sk-...
```

#### Gemini
```
Model: gemini-2.0-flash-exp
API Key: AIzaSy...
```

---

## 🛠 技术栈

### 前端
- **React 19** + **TypeScript**
- **Vite** - 极速构建
- **Tailwind CSS** - 实用优先的 CSS
- **Mammoth.js** - DOCX 解析

### 后端/数据
- **Supabase**
  - PostgreSQL + pgvector
  - Storage (对象存储)
  - Realtime (可选)

### AI
- **OpenAI API** - GPT-4o
- **DeepSeek API** - 开源高性价比
- **Google Gemini API** - 免费额度

### 部署
- **Cloudflare Pages** - 前端托管
- **GitHub Actions** - CI/CD

---

## 📁 项目结构

```
ucl-mpa-esg/
├── src/
│   ├── components/
│   │   ├── Icons.tsx          # SVG 图标组件
│   │   └── SettingsDialog.tsx # 设置对话框
│   ├── services/
│   │   ├── fileService.ts     # 文件解析服务
│   │   ├── gptService.ts      # AI 推理服务
│   │   └── supabaseService.ts # Supabase 客户端
│   ├── App.tsx                # 主应用组件
│   ├── types.ts               # TypeScript 类型定义
│   ├── index.tsx              # 入口文件
│   └── index.css              # 全局样式
├── supabase/
│   └── schema.sql             # 数据库结构
├── index.html                 # HTML 模板
├── vite.config.ts             # Vite 配置
├── tailwind.config.js         # Tailwind 配置
├── tsconfig.json              # TypeScript 配置
├── package.json               # 依赖管理
├── DEPLOYMENT.md              # 部署详细指南
├── USAGE.md                   # 使用手册
└── README.md                  # 项目说明

```

---

## 💰 成本估算

### 免费层（个人使用完全够用）

| 服务 | 免费额度 | 预估使用 |
|------|---------|---------|
| **Supabase** | 500MB 存储 + 无限行 | < 100MB |
| **Cloudflare Pages** | 无限带宽 + 500次构建/月 | < 50次构建 |
| **DeepSeek API** | $5 赠金 | $0.5/月 |
| **Gemini API** | 每天免费 1500次请求 | 足够使用 |

**总成本：$0-2/月** （仅 AI API 费用，选 DeepSeek 更便宜）

---

## 🎯 使用场景

### 📖 复习考试
```
上传所有课程 PPT 和笔记 → 提问
"总结 Week 1-4 的核心概念"
"ESG 评估的关键指标有哪些？"
```

### ✍️ 写作业
```
上传相关阅读材料 → 提问
"帮我列出关于[主题]的论文大纲"
"这个案例可以用哪些理论框架分析？"
```

### 📝 整理笔记
```
上传原始课堂笔记 → 提问
"将这份笔记整理成结构化大纲"
"生成这份笔记的思维导图"
```

### 🔍 查找信息
```
输入问题 → AI 搜索知识库
"在哪份材料中提到了制度分析？"
"找出所有关于气候政策的内容"
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发计划

- [ ] 完整的 PDF 解析（pdf.js）
- [ ] PPT 文件支持（pptx.js）
- [ ] 向量语义搜索（pgvector）
- [ ] 对话历史管理
- [ ] 多用户支持（Supabase Auth）
- [ ] 导出 Markdown/PDF
- [ ] 移动端 App

---

## 📄 许可证

MIT License - 自由使用、修改和分发

---

## 💝 致谢

- [Supabase](https://supabase.com) - 开源的 Firebase 替代品
- [Cloudflare](https://www.cloudflare.com) - 全球 CDN 和边缘计算
- [OpenAI](https://openai.com) - GPT 系列模型
- [DeepSeek](https://www.deepseek.com) - 高性价比 AI
- [Google Gemini](https://ai.google.dev) - 免费 AI API

---

**Made with 🐻 for UCL MPA students**

如需帮助，请查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 和 [USAGE.md](./USAGE.md)
