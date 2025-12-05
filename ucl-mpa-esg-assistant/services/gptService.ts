
import { Folder, AIProvider, ProviderConfig } from '../types';
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `
You are an academic assistant for a UCL MPA (ESG) student.
You must always answer with the following fixed structure, in Chinese and English:

1. 背景 / Background
2. 问题界定 / Problem framing
3. 制度分析 / Institutional analysis
4. 政策工具比较 / Policy instruments
5. 公正与分配影响 / Justice & distributional impacts
6. 建议 / Recommendations

For each section, first write a concise paragraph in Chinese, then a corresponding paragraph in English.
Use an academic, policy- and institution-oriented tone, grounded in the user's notes when relevant.
`;

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
  useSearch: boolean = false
): Promise<GenerationResult> => {
  
  const fullPrompt = `User question:\n${question}\n\nSelected notes context:\n${context || '[No notes available]'}`;

  // --- GEMINI HANDLER ---
  if (provider === 'gemini' && config.apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      
      // Determine model name
      let modelName = config.model || 'gemini-2.5-flash';
      // Normalize common aliases
      if (modelName === 'gemini flash') modelName = 'gemini-2.5-flash';
      if (modelName === 'gemini pro') modelName = 'gemini-3-pro-preview';

      const reqConfig: any = {
        systemInstruction: SYSTEM_PROMPT,
      };

      // Enable Google Search if requested
      if (useSearch) {
        reqConfig.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: reqConfig
      });

      return {
        text: response.text || "No response text.",
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
      };

    } catch (e: any) {
      console.error("Gemini API Error", e);
      throw new Error(`Gemini Error: ${e.message}`);
    }
  }

  // --- OPENAI / DEEPSEEK HANDLER ---
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
            { role: 'system', content: SYSTEM_PROMPT },
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

  // --- FALLBACK MOCK HANDLER ---
  return { text: generateMockResponse(context) };
};

const generateMockResponse = (context: string): string => {
  const hasContext = context.length > 0;
  
  return `
**1. 背景 / Background**

(Demo Mode) 基于你本地保存的资料（${hasContext ? '已检测到笔记内容' : '暂无相关笔记'}），本分析从 UCL MPA (ESG) 视角出发。
(Demo Mode) Drawing on your local notes (${hasContext ? 'notes detected' : 'no specific notes detected'}), this analysis adopts a UCL MPA (ESG) perspective.

**2. 问题界定 / Problem framing**

核心问题在于如何在多层级治理体系中平衡经济增长与脱碳目标。
The core problem lies in balancing economic growth with decarbonization goals within a multi-level governance system.

**3. 制度分析 / Institutional analysis**

制度惰性与路径依赖是主要的转型障碍。
Institutional inertia and path dependence act as primary barriers to transition.

**4. 政策工具比较 / Policy instruments**

对比市场型工具（如碳交易）与命令控制型工具。
Comparing market-based instruments (e.g., carbon trading) with command-and-control instruments.

**5. 公正与分配影响 / Justice & distributional impacts**

转型必须考虑“谁受益，谁买单”。
The transition must consider "who benefits and who pays."

**6. 建议 / Recommendations**

(1) 加强跨部门协调机制；(2) 混合使用政策工具。
(1) Strengthen cross-sectoral coordination mechanisms; (2) Employ a policy mix.

---
*Note: This is a demo response. Configure your API Keys in settings or select a provider.*
`;
}
