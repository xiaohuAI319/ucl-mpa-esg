import { Folder, AIProvider, ProviderConfig } from '../types';
import { GoogleGenAI } from "@google/genai";

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
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      
      let modelName = config.model || 'gemini-2.0-flash-exp';
      
      const reqConfig: any = {
        systemInstruction: systemPrompt,
      };

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
