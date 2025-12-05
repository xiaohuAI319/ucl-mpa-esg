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
  groundingMetadata?: any;
}

export type AIProvider = 'openai' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface AppSettings {
  activeProvider: AIProvider;
  providers: Record<AIProvider, ProviderConfig>;
  supabase: SupabaseConfig;
}

export type Tab = 'files' | 'chat';

declare global {
  interface Window {
    mammoth: any;
  }
}
