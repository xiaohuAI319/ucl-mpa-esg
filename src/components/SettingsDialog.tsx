import React, { useEffect, useState } from 'react';
import { AppSettings, AIProvider } from '../types';
import { supabaseService } from '../services/supabaseService';
import { DEFAULT_SYSTEM_PROMPT, listGeminiModels } from '../services/gptService';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

type SettingsTab = 'database' | 'api' | 'prompt';

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('database');
  const [viewProvider, setViewProvider] = useState<AIProvider>(settings.activeProvider);
  const [testStatus, setTestStatus] = useState<string>('');
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setViewProvider(settings.activeProvider);
  }, [settings.activeProvider, settings.providers, settings.supabase, settings.systemPrompt, isOpen]);

  // 页面初始化时，如果有 Gemini Key，自动获取模型列表
  useEffect(() => {
    if (isOpen && settings.providers.gemini?.apiKey) {
      loadGeminiModels(settings.providers.gemini.apiKey);
    }
  }, [isOpen]);

  // 加载 Gemini 模型列表
  const loadGeminiModels = async (apiKey: string) => {
    setIsLoadingModels(true);
    const models = await listGeminiModels(apiKey);
    setGeminiModels(models);
    setIsLoadingModels(false);
  };

  const updateProviderConfig = (key: string, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [viewProvider]: {
          ...prev.providers[viewProvider],
          [key]: value
        }
      }
    }));
  };

  const updateSupabaseConfig = (key: string, value: string) => {
    setLocalSettings(prev => {
      return {
        ...prev,
        supabase: {
          ...prev.supabase,
          [key]: value
        }
      };
    });
  };

  const updateSystemPrompt = (value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      systemPrompt: {
        systemPrompt: value
      }
    }));
  };

  const handleTestSupabase = async () => {
    setTestStatus('testing');
    try {
      supabaseService.initialize(localSettings.supabase.url, localSettings.supabase.publishableKey);
      const isConnected = await supabaseService.testConnection();
      setTestStatus(isConnected ? 'success' : 'failed');
      setTimeout(() => setTestStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setTestStatus('failed');
      setTimeout(() => setTestStatus(''), 3000);
    }
  };

  if (!isOpen) return null;

  const currentConfig = localSettings.providers[viewProvider];

  return (
    <div className="fixed inset-0 bg-slate-800/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#FFFBF0] rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] border-4 border-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative transform scale-100 animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-5 top-5 text-salmon hover:text-red-500 font-black text-xl bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-transform hover:rotate-90"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-black text-slate-700 mb-1 flex items-center gap-2">
          <span className="text-3xl">⚙️</span> 设置中心
        </h2>
        <p className="text-sm text-slate-500 mb-6 font-semibold">
          配置数据库、API 和系统提示词
        </p>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 p-1 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'database' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            ☁️ 数据库配置
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'api' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            🤖 API 配置
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'prompt' 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            💬 提示词配置
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* Database Tab */}
          {activeTab === 'database' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="text-xl">☁️</span> Supabase 云端存储
              </h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Supabase URL</label>
                <input 
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                  placeholder="https://xxx.supabase.co"
                  value={localSettings.supabase.url}
                  onChange={e => updateSupabaseConfig('url', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Publishable Key</label>
                <input 
                  type="password"
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                  placeholder="sb_publishable_..."
                  value={localSettings.supabase.publishableKey}
                  onChange={e => updateSupabaseConfig('publishableKey', e.target.value)}
                />
              </div>

              <button
                onClick={handleTestSupabase}
                disabled={!localSettings.supabase.url || !localSettings.supabase.publishableKey}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  testStatus === 'success' ? 'bg-green-100 text-green-600' :
                  testStatus === 'failed' ? 'bg-red-100 text-red-600' :
                  testStatus === 'testing' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                }`}
              >
                {testStatus === 'success' ? '✓ 连接成功！' :
                 testStatus === 'failed' ? '✗ 连接失败' :
                 testStatus === 'testing' ? '测试中...' :
                 '测试连接'}
              </button>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="text-xl">🤖</span> AI 提供商配置
              </h3>

              <div className="flex gap-2 mb-4 p-1 bg-white rounded-2xl border border-slate-100 shadow-inner">
                {(['openai', 'deepseek', 'gemini'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setViewProvider(p)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                      viewProvider === p 
                        ? 'bg-indigo-200 text-slate-700 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    } capitalize`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Base URL */}
              {viewProvider !== 'gemini' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Base URL</label>
                  <input 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                    placeholder="https://..."
                    value={currentConfig.baseUrl}
                    onChange={e => updateProviderConfig('baseUrl', e.target.value)}
                  />
                </div>
              )}

              {/* Model Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">
                  模型名称
                  {viewProvider === 'gemini' && isLoadingModels && (
                    <span className="ml-2 text-blue-500">🔄 加载中...</span>
                  )}
                  {viewProvider === 'gemini' && !isLoadingModels && geminiModels.length === 0 && (
                    <span className="ml-2 text-yellow-500">⚠️ 请先配置 API Key</span>
                  )}
                </label>
                {viewProvider === 'gemini' ? (
                  geminiModels.length > 0 ? (
                    <select
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
                      value={currentConfig.model}
                      onChange={e => updateProviderConfig('model', e.target.value)}
                    >
                      {geminiModels.map(model => (
                        <option key={model} value={model}>
                          {model}
                          {model.includes('flash') ? ' ⚡' : ''}
                          {model.includes('pro') ? ' 💎' : ''}
                          {model.includes('exp') ? ' 🧪' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                      placeholder="gemini-1.5-flash"
                      value={currentConfig.model}
                      onChange={e => updateProviderConfig('model', e.target.value)}
                      disabled={isLoadingModels}
                    />
                  )
                ) : (
                  <input 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                    placeholder={viewProvider === 'deepseek' ? "deepseek-chat" : "gpt-4o"}
                    value={currentConfig.model}
                    onChange={e => updateProviderConfig('model', e.target.value)}
                  />
                )}
                {viewProvider === 'gemini' && geminiModels.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2 pl-2">
                    ✅ 已加载 {geminiModels.length} 个可用模型
                  </p>
                )}
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">API Key</label>
                <input 
                  type="password"
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200"
                  placeholder="sk-..."
                  value={currentConfig.apiKey}
                  onChange={e => updateProviderConfig('apiKey', e.target.value)}
                />
              </div>

              {/* Gemini Test Button */}
              {viewProvider === 'gemini' && (
                <button
                  onClick={() => {
                    if (currentConfig.apiKey) {
                      loadGeminiModels(currentConfig.apiKey);
                    }
                  }}
                  disabled={!currentConfig.apiKey || isLoadingModels}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                    geminiModels.length > 0 ? 'bg-green-100 text-green-600' :
                    isLoadingModels ? 'bg-yellow-100 text-yellow-600' :
                    'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  {isLoadingModels ? '🔄 加载模型列表中...' :
                   geminiModels.length > 0 ? `✓ 已加载 ${geminiModels.length} 个模型` :
                   '🔍 测试 API Key 并加载模型'}
                </button>
              )}
            </div>
          )}

          {/* Prompt Tab */}
          {activeTab === 'prompt' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <span className="text-xl">💬</span> 系统提示词设置
              </h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">System Prompt</label>
                <textarea
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-200 min-h-[300px] resize-y"
                  placeholder="输入你的系统提示词..."
                  value={localSettings.systemPrompt?.systemPrompt || DEFAULT_SYSTEM_PROMPT}
                  onChange={e => updateSystemPrompt(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-2 pl-2">
                  💡 提示：定义 AI 助手的角色、专业领域和回答风格
                </p>
              </div>

              <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-indigo-600 mb-2">📝 提示词编写建议：</p>
                <ul className="text-xs text-slate-600 space-y-1 pl-4">
                  <li>• 明确定义 AI 的身份和专业领域</li>
                  <li>• 说明回答的风格和语气（学术、专业、友好等）</li>
                  <li>• 指定需要关注的重点方向</li>
                  <li>• 提醒使用提供的文档上下文</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex gap-3 mt-8">
          <button 
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-lg hover:from-indigo-600 hover:to-purple-600 hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            保存设置 <span className="text-xl">✨</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
