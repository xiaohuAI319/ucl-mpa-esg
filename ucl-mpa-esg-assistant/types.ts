
export interface FileItem {
  id: string;
  name: string;
  content: string;
  isText: boolean;
  fromDocx: boolean;
  timestamp: number;
}

export interface Folder {
  id: string;
  name: string;
  files: FileItem[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  groundingMetadata?: any; // For Gemini Search results
}

export type AIProvider = 'openai' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AppSettings {
  activeProvider: AIProvider;
  providers: Record<AIProvider, ProviderConfig>;
}

export type Tab = 'files' | 'chat';

// Helper type for the window object with mammoth
declare global {
  interface Window {
    mammoth: any;
  }
}
