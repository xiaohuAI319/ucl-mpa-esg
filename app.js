// ============================================
// UCL MPA ESG 学术助手 - 主逻辑
// ============================================

// 配置常量
const CONFIG_KEYS = {
  SUPABASE_URL: 'supabase_url',
  SUPABASE_KEY: 'supabase_anon_key',
  OPENAI_KEY: 'openai_api_key',
  OPENAI_BASE: 'openai_base_url',
  DEEPSEEK_KEY: 'deepseek_api_key',
  DEEPSEEK_BASE: 'deepseek_base_url',
  GEMINI_KEY: 'gemini_api_key',
  SYSTEM_PROMPT: 'system_prompt'
};

// 全局变量
let supabase = null;
let currentUser = null;
let currentFolders = [];

// ============================================
// 初始化
// ============================================

async function init() {
  // 检查 Supabase 配置
  const supabaseUrl = localStorage.getItem(CONFIG_KEYS.SUPABASE_URL);
  const supabaseKey = localStorage.getItem(CONFIG_KEYS.SUPABASE_KEY);

  if (!supabaseUrl || !supabaseKey) {
    showSupabaseConfigPrompt();
    return;
  }

  // 初始化 Supabase客户端
  try {
    supabase = supabase.createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('Supabase 初始化失败:', error);
    showSupabaseConfigPrompt();
    return;
  }

  // 检查登录状态
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    onUserLoggedIn();
  } else {
    showLoginButton();
  }

  // 绑定事件
  bindEvents();
  
  // 加载系统提示词
  loadSystemPrompt();
}

// ============================================
// 用户认证
// ============================================

function showSupabaseConfigPrompt() {
  document.getElementById('supabase-config-prompt').classList.remove('hidden');
}

async function saveSupabaseConfig() {
  const url = document.getElementById('supabase-url-input').value.trim();
  const key = document.getElementById('supabase-key-input').value.trim();

  if (!url || !key) {
    alert('请填写完整的 Supabase 配置信息');
    return;
  }

  localStorage.setItem(CONFIG_KEYS.SUPABASE_URL, url);
  localStorage.setItem(CONFIG_KEYS.SUPABASE_KEY, key);
  
  location.reload();
}

function showLoginButton() {
  document.getElementById('btn-login').classList.remove('hidden');
  document.getElementById('btn-logout').classList.add('hidden');
  document.getElementById('user-info').textContent = '未登录';
}

async function login() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  
  if (error) {
    console.error('登录失败:', error);
    alert('登录失败: ' + error.message);
  }
}

async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

function onUserLoggedIn() {
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('btn-logout').classList.remove('hidden');
  document.getElementById('user-info').textContent = currentUser.email;
  
  // 加载数据
  loadFolders();
  updateStats();
}

// ============================================
// 文件夹管理
// ============================================

async function loadFolders() {
  try {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    currentFolders = data || [];
    renderFolders();
  } catch (error) {
    console.error('加载文件夹失败:', error);
    showToast('加载文件夹失败: ' + error.message);
  }
}

async function createFolder(name) {
  if (!name) return;

  try {
    const { data, error } = await supabase
      .from('folders')
      .insert([{ name, user_id: currentUser.id }])
      .select();

    if (error) throw error;

    currentFolders.unshift(data[0]);
    renderFolders();
    showToast('文件夹创建成功');
  } catch (error) {
    console.error('创建文件夹失败:', error);
    showToast('创建文件夹失败: ' + error.message);
  }
}

async function deleteFolder(folderId) {
  if (!confirm('确认删除该文件夹及其中所有文件？')) return;

  try {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) throw error;

    currentFolders = currentFolders.filter(f => f.id !== folderId);
    renderFolders();
    showToast('文件夹已删除');
  } catch (error) {
    console.error('删除文件夹失败:', error);
    showToast('删除文件夹失败: ' + error.message);
  }
}

function renderFolders() {
  const folderList = document.getElementById('folder-list');
  const template = document.getElementById('folder-template');
  
  folderList.innerHTML = '';

  if (currentFolders.length === 0) {
    folderList.innerHTML = '<p class="text-center text-slate-400 py-8">暂无文件夹，请创建一个开始上传文档</p>';
    return;
  }

  currentFolders.forEach(folder => {
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.folder-name').textContent = folder.name;
    
    // 删除按钮
    clone.querySelector('.btn-delete-folder').addEventListener('click', () => {
      deleteFolder(folder.id);
    });

    // 文件上传
    const fileInput = clone.querySelector('.file-input');
    const fileListEl = clone.querySelector('.file-list');

    fileInput.addEventListener('change', (e) => {
      handleFileUpload(folder.id, e.target.files, fileListEl);
      e.target.value = ''; // 清空input
    });

    // 加载文件列表
    loadFiles(folder.id, fileListEl);

    folderList.appendChild(clone);
  });
}

// ============================================
// 文件上传与解析
// ============================================

async function handleFileUpload(folderId, files, fileListEl) {
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files);
  
  for (const file of fileArray) {
    await uploadAndParseFile(folderId, file, fileListEl);
  }
  
  updateStats();
}

async function uploadAndParseFile(folderId, file, fileListEl) {
  const fileName = file.name;
  const fileType = fileName.split('.').pop().toLowerCase();
  const fileSize = file.size;

  showToast(`正在上传 ${fileName}...`);

  try {
    // 1. 上传文件到 Supabase Storage
    const filePath = `${currentUser.id}/${folderId}/${Date.now()}_${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. 解析文件内容
    let content = '';
    let parseStatus = 'pending';
    let parseError = null;

    try {
      content = await parseFile(file, fileType);
      parseStatus = 'success';
    } catch (error) {
      console.error(`解析 ${fileName} 失败:`, error);
      parseError = error.message;
      parseStatus = 'failed';
    }

    // 3. 保存文档记录到数据库
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{
        user_id: currentUser.id,
        folder_id: folderId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: filePath,
        content: content,
        parse_status: parseStatus,
        parse_error: parseError,
        metadata: { original_name: fileName }
      }])
      .select();

    if (docError) throw docError;

    // 4. 如果解析成功，生成向量嵌入（后台处理）
    if (parseStatus === 'success' && content) {
      generateEmbedding(docData[0].id, content);
    }

    // 5. 刷新文件列表
    loadFiles(folderId, fileListEl);
    showToast(`${fileName} 上传成功`);

  } catch (error) {
    console.error(`上传 ${fileName} 失败:`, error);
    showToast(`上传 ${fileName} 失败: ` + error.message);
  }
}

async function parseFile(file, fileType) {
  switch (fileType) {
    case 'txt':
    case 'md':
    case 'markdown':
      return await readTextFile(file);
    
    case 'docx':
      return await parseDocx(file);
    
    case 'pdf':
      return await parsePdf(file);
    
    case 'pptx':
      // PPTX 需要后端处理，这里暂时返回空
      showToast('PPTX 解析需要后端支持，当前仅保存文件名');
      return '';
    
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function parseDocx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value || '');
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function parsePdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        
        resolve(fullText.trim());
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ============================================
// 向量嵌入生成
// ============================================

async function generateEmbedding(documentId, content) {
  // 获取 OpenAI API Key
  const apiKey = localStorage.getItem(CONFIG_KEYS.OPENAI_KEY);
  if (!apiKey) {
    console.warn('未配置 OpenAI API Key，跳过向量化');
    return;
  }

  try {
    // 截取前8000字符（避免token超限）
    const truncatedContent = content.slice(0, 8000);

    // 调用 OpenAI Embeddings API
    const baseUrl = localStorage.getItem(CONFIG_KEYS.OPENAI_BASE) || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncatedContent
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding API 错误: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;

    // 更新数据库
    await supabase
      .from('documents')
      .update({ embedding })
      .eq('id', documentId);

    console.log(`文档 ${documentId} 向量化完成`);
  } catch (error) {
    console.error('生成向量嵌入失败:', error);
  }
}

// ============================================
// 文件列表
// ============================================

async function loadFiles(folderId, fileListEl) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderFileList(fileListEl, data || []);
  } catch (error) {
    console.error('加载文件列表失败:', error);
  }
}

function renderFileList(el, files) {
  el.innerHTML = '';

  if (files.length === 0) {
    el.innerHTML = '<li class="text-slate-400">暂无文件</li>';
    return;
  }

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between p-2 bg-slate-50 rounded-lg';

    const statusIcon = {
      'success': '✅',
      'failed': '❌',
      'pending': '⏳',
      'processing': '⚙️'
    }[file.parse_status] || '📄';

    const typeIcon = {
      'pdf': '📕',
      'docx': '📘',
      'pptx': '📊',
      'txt': '📝',
      'md': '📝'
    }[file.file_type] || '📄';

    li.innerHTML = `
      <div class="flex items-center gap-2 flex-1">
        <span>${typeIcon}</span>
        <span class="text-sm">${file.file_name}</span>
        <span class="text-xs text-slate-400">(${(file.file_size / 1024).toFixed(1)} KB)</span>
        <span>${statusIcon}</span>
      </div>
      <button class="text-xs text-red-500 hover:underline" onclick="deleteFile(${file.id})">删除</button>
    `;

    el.appendChild(li);
  });
}

async function deleteFile(fileId) {
  if (!confirm('确认删除该文件？')) return;

  try {
    // 获取文件信息
    const { data: file } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', fileId)
      .single();

    // 删除存储的文件
    if (file && file.storage_path) {
      await supabase.storage
        .from('documents')
        .remove([file.storage_path]);
    }

    // 删除数据库记录
    await supabase
      .from('documents')
      .delete()
      .eq('id', fileId);

    showToast('文件已删除');
    loadFolders(); // 刷新列表
    updateStats();
  } catch (error) {
    console.error('删除文件失败:', error);
    showToast('删除文件失败: ' + error.message);
  }
}

// 全局暴露 deleteFile 函数
window.deleteFile = deleteFile;

// ============================================
// AI 聊天
// ============================================

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message) return;

  // 显示用户消息
  appendMessage('user', message);
  input.value = '';

  // 显示加载状态
  appendMessage('assistant', '<span class="text-slate-400">正在思考...</span>');

  try {
    // 1. 生成问题的向量嵌入
    const queryEmbedding = await generateQueryEmbedding(message);

    // 2. 搜索相关文档
    const relevantDocs = await searchDocuments(queryEmbedding);

    // 3. 构建上下文
    const context = relevantDocs
      .map(doc => `【${doc.file_name}】\n${doc.content.slice(0, 1000)}`)
      .join('\n\n');

    // 4. 调用 AI 模型
    const model = document.getElementById('model-select').value;
    const response = await callAI(model, message, context);

    // 5. 显示回复
    const chatBox = document.getElementById('chat-box');
    chatBox.removeChild(chatBox.lastChild); // 移除加载状态
    appendMessage('assistant', response);

  } catch (error) {
    console.error('发送消息失败:', error);
    const chatBox = document.getElementById('chat-box');
    chatBox.removeChild(chatBox.lastChild);
    appendMessage('assistant', `<span class="text-red-500">错误: ${error.message}</span>`);
  }
}

async function generateQueryEmbedding(query) {
  const apiKey = localStorage.getItem(CONFIG_KEYS.OPENAI_KEY);
  if (!apiKey) {
    throw new Error('未配置 OpenAI API Key');
  }

  const baseUrl = localStorage.getItem(CONFIG_KEYS.OPENAI_BASE) || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API 错误: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchDocuments(queryEmbedding) {
  try {
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      filter_user_id: currentUser.id
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('搜索文档失败:', error);
    return [];
  }
}

async function callAI(model, question, context) {
  const systemPrompt = document.getElementById('system-prompt').value || 
    '你是一个 UCL MPA ESG 学术助手，基于用户提供的笔记和文献进行专业的学术分析。';

  const userPrompt = `用户问题：${question}\n\n相关笔记：\n${context || '[无相关笔记]'}`;

  if (model.startsWith('gpt-')) {
    return await callOpenAI(model, systemPrompt, userPrompt);
  } else if (model === 'deepseek-chat') {
    return await callDeepSeek(systemPrompt, userPrompt);
  } else if (model.startsWith('gemini')) {
    return await callGemini(model, systemPrompt, userPrompt);
  } else {
    throw new Error('不支持的模型');
  }
}

async function callOpenAI(model, systemPrompt, userPrompt) {
  const apiKey = localStorage.getItem(CONFIG_KEYS.OPENAI_KEY);
  if (!apiKey) throw new Error('未配置 OpenAI API Key');

  const baseUrl = localStorage.getItem(CONFIG_KEYS.OPENAI_BASE) || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callDeepSeek(systemPrompt, userPrompt) {
  const apiKey = localStorage.getItem(CONFIG_KEYS.DEEPSEEK_KEY);
  if (!apiKey) throw new Error('未配置 DeepSeek API Key');

  const baseUrl = localStorage.getItem(CONFIG_KEYS.DEEPSEEK_BASE) || 'https://api.deepseek.com/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(model, systemPrompt, userPrompt) {
  const apiKey = localStorage.getItem(CONFIG_KEYS.GEMINI_KEY);
  if (!apiKey) throw new Error('未配置 Gemini API Key');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\n${userPrompt}`
        }]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function appendMessage(role, content) {
  const chatBox = document.getElementById('chat-box');
  
  // 移除欢迎消息
  if (chatBox.children[0]?.textContent.includes('开始提问吧')) {
    chatBox.innerHTML = '';
  }

  const div = document.createElement('div');
  div.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');

  const bubble = document.createElement('div');
  bubble.className = 'max-w-[80%] px-4 py-3 rounded-2xl ' +
    (role === 'user'
      ? 'bg-blue-600 text-white rounded-br-none'
      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none');

  bubble.innerHTML = content;
  div.appendChild(bubble);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ============================================
// 统计信息
// ============================================

async function updateStats() {
  try {
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    document.getElementById('doc-count').textContent = count || 0;

    // 存储使用量（简化计算）
    const { data } = await supabase
      .from('documents')
      .select('file_size');
    
    const totalSize = (data || []).reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    document.getElementById('storage-usage').textContent = (totalSize / 1024 / 1024).toFixed(2) + ' MB';

  } catch (error) {
    console.error('更新统计信息失败:', error);
  }
}

// ============================================
// UI 辅助函数
// ============================================

function showToast(message) {
  // 简单的 toast 实现
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function loadSystemPrompt() {
  const saved = localStorage.getItem(CONFIG_KEYS.SYSTEM_PROMPT);
  if (saved) {
    document.getElementById('system-prompt').value = saved;
  }
}

function saveSystemPrompt() {
  const prompt = document.getElementById('system-prompt').value;
  localStorage.setItem(CONFIG_KEYS.SYSTEM_PROMPT, prompt);
  showToast('提示词已保存');
}

// ============================================
// 事件绑定
// ============================================

function bindEvents() {
  // 面板切换
  document.getElementById('btn-input').addEventListener('click', () => {
    document.getElementById('panel-input').classList.remove('hidden');
    document.getElementById('panel-output').classList.add('hidden');
  });

  document.getElementById('btn-output').addEventListener('click', () => {
    document.getElementById('panel-output').classList.remove('hidden');
    document.getElementById('panel-input').classList.add('hidden');
  });

  // 文件夹管理
  document.getElementById('btn-add-folder').addEventListener('click', () => {
    const name = document.getElementById('folder-name-input').value.trim();
    if (name) {
      createFolder(name);
      document.getElementById('folder-name-input').value = '';
    }
  });

  document.getElementById('btn-refresh').addEventListener('click', loadFolders);

  // AI 设置
  document.getElementById('btn-ai-config').addEventListener('click', () => {
    document.getElementById('ai-config-overlay').classList.remove('hidden');
    loadAIConfig();
  });

  document.getElementById('btn-ai-config-close').addEventListener('click', () => {
    document.getElementById('ai-config-overlay').classList.add('hidden');
  });

  document.getElementById('btn-ai-config-save').addEventListener('click', saveAIConfig);

  // 聊天
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('btn-new-chat').addEventListener('click', () => {
    document.getElementById('chat-box').innerHTML = '<div class="text-center text-slate-400 text-sm py-8">👋 开始新对话</div>';
  });

  // 系统提示词
  document.getElementById('btn-save-prompt').addEventListener('click', saveSystemPrompt);

  // Supabase 配置
  document.getElementById('btn-save-supabase-config').addEventListener('click', saveSupabaseConfig);

  // 登录/登出
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('btn-logout').addEventListener('click', logout);
}

function loadAIConfig() {
  document.getElementById('openai-api-key').value = localStorage.getItem(CONFIG_KEYS.OPENAI_KEY) || '';
  document.getElementById('openai-base-url').value = localStorage.getItem(CONFIG_KEYS.OPENAI_BASE) || 'https://api.openai.com/v1';
  document.getElementById('deepseek-api-key').value = localStorage.getItem(CONFIG_KEYS.DEEPSEEK_KEY) || '';
  document.getElementById('deepseek-base-url').value = localStorage.getItem(CONFIG_KEYS.DEEPSEEK_BASE) || 'https://api.deepseek.com/v1';
  document.getElementById('gemini-api-key').value = localStorage.getItem(CONFIG_KEYS.GEMINI_KEY) || '';
}

function saveAIConfig() {
  localStorage.setItem(CONFIG_KEYS.OPENAI_KEY, document.getElementById('openai-api-key').value);
  localStorage.setItem(CONFIG_KEYS.OPENAI_BASE, document.getElementById('openai-base-url').value);
  localStorage.setItem(CONFIG_KEYS.DEEPSEEK_KEY, document.getElementById('deepseek-api-key').value);
  localStorage.setItem(CONFIG_KEYS.DEEPSEEK_BASE, document.getElementById('deepseek-base-url').value);
  localStorage.setItem(CONFIG_KEYS.GEMINI_KEY, document.getElementById('gemini-api-key').value);
  
  showToast('AI 配置已保存');
  document.getElementById('ai-config-overlay').classList.add('hidden');
}

// ============================================
// 启动应用
// ============================================

document.addEventListener('DOMContentLoaded', init);
