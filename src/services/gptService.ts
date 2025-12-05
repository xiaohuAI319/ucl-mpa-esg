import { Folder, AIProvider, ProviderConfig } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 获取 Gemini 可用模型列表
export const listGeminiModels = async (apiKey: string): Promise<string[]> => {
  if (!apiKey) return [];
  
  try {
    // 使用正确的 REST API 获取模型列表
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 过滤出支持 generateContent 的模型
    const availableModels = data.models
      ?.filter((model: any) => 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => {
        // 移除 "models/" 前缀
        const name = model.name.replace('models/', '');
        return name;
      })
      .sort() || []; // 按字母排序
    
    console.log('✅ Gemini 可用模型:', availableModels);
    return availableModels;
    
  } catch (error) {
    console.error('❌ 获取 Gemini 模型列表失败:', error);
    return []; // 静默失败，返回空数组
  }
};

// 默认系统提示词（仅作为备用，优先使用配置中的提示词）
export const DEFAULT_SYSTEM_PROMPT = `You are an academic assistant for a UCL MPA (ESG) student.

Analyze questions from an academic policy perspective, focusing on:
- Environmental, Social, and Governance (ESG) frameworks
- Public policy analysis
- Institutional perspectives
- Evidence-based recommendations

Use the provided notes context to ground your answers. Maintain an academic tone while being helpful and clear.`;

export const collectFileContext = (folders: Folder[], maxChars = 8000): string => {
  const pieces: string[] = [];
  let used = 0;
  
  for (const folder of folders) {
    for (const file of folder.files) {
      if (!file.isText || !file.content) continue;
      if (used >= maxChars) break;
      
      const header = `【${folder.name} / ${file.name}】\n`;
      const remaining = maxChars - used - header.length;
      if (remaining <= 0) break;
      
      const snippet = file.content.slice(0, remaining);
      pieces.push(header + snippet);
      used += header.length + snippet.length + 2;
    }
    if (used >= maxChars) break;
  }
  
  return pieces.join('\n\n');
};

interface GenerationResult {
  text: string;
  groundingMetadata?: any;
}

export const generateResponse = async (
  question: string,
  context: string,
  provider: AIProvider,
  config: ProviderConfig,
  useSearch: boolean = false,
  customSystemPrompt?: string
): Promise<GenerationResult> => {
  
  // 优先使用自定义提示词，否则使用默认提示词
  const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const fullPrompt = `User question:\n${question}\n\nNotes context:\n${context || '[No notes available]'}`;

  // Gemini Handler
  if (provider === 'gemini' && config.apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const modelName = config.model || 'gemini-1.5-flash';
      
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      // 配置生成参数
      const generationConfig = {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
      };

      // 如果启用搜索，使用 code_execution 代替（Google Search 需要特殊权限）
      // 注意：Google Search 功能需要 Gemini API 的特殊访问权限
      let result;
      if (useSearch) {
        // 尝试使用 Google Search，如果失败则回退到普通模式
        try {
          result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig,
          });
          
          // 如果需要网络搜索，在提示中明确说明
          if (result.response.text().includes('search') || result.response.text().includes('查找')) {
            const searchPrompt = `${fullPrompt}\n\n⚠️ 注意：请基于你的知识回答。如果信息可能过时，请明确说明。`;
            result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: searchPrompt }] }],
              generationConfig,
            });
          }
        } catch (searchError) {
          console.warn('⚠️ Google Search 功能不可用，使用标准模式:', searchError);
          result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig,
          });
        }
      } else {
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig,
        });
      }

      const response = result.response;
      
      return {
        text: response.text() || "No response text.",
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
      };

    } catch (e: any) {
      console.error("Gemini API Error", e);
      
      // 处理 429 速率限制错误
      if (e.message?.includes('429') || e.message?.includes('quota')) {
        const retryMatch = e.message.match(/retry in (\d+)/i);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1]) : 60;
        throw new Error(`⏰ Gemini 请求过于频繁，请等待 ${retrySeconds} 秒后重试\n\n💡 建议：切换到 DeepSeek 或 OpenAI 模型`);
      }
      
      throw new Error(`Gemini Error: ${e.message}`);
    }
  }

  // OpenAI / DeepSeek Handler
  if ((provider === 'openai' || provider === 'deepseek') && config.baseUrl && config.apiKey) {
    try {
      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt }
          ],
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${provider}): ${response.status} ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "No response content.";
      
      return { text: content };

    } catch (e: any) {
      console.error("OpenAI/DeepSeek API Error", e);
      throw new Error(e.message);
    }
  }

  // Fallback Mock Handler
  return { text: generateMockResponse(context) };
};

const generateMockResponse = (context: string): string => {
  const hasContext = context.length > 0;
  
  return `
**Academic Analysis (Demo Mode)** 🐻

Based on your notes (${hasContext ? 'content detected ✓' : 'no notes available'}), here's an academic perspective:

**Policy Context**
From a UCL MPA (ESG) standpoint, the question intersects with environmental governance, social equity, and institutional frameworks.

**Key Considerations**
- Multi-stakeholder governance
- Evidence-based policy design
- Distributional impacts
- Institutional capacity

**Recommendations**
1. Conduct stakeholder analysis
2. Review comparative policy cases
3. Assess implementation feasibility
4. Consider justice dimensions

---
*Demo Mode Active. Configure AI API keys in Settings to unlock full analysis.*
`;
};
