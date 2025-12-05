import React, { useEffect, useState } from 'react';
import { AppSettings, AIProvider } from '../types';
import { supabaseService } from '../services/supabaseService';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [viewProvider, setViewProvider] = useState<AIProvider>(settings.activeProvider);
  const [testStatus, setTestStatus] = useState<string>('');

  useEffect(() => {
    setLocalSettings(settings);
    setViewProvider(settings.activeProvider);
  }, [settings, isOpen]);

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
    setLocalSettings(prev => ({
      ...prev,
      supabase: {
        ...prev.supabase,
        [key]: value
      }
    }));
  };

  const handleTestSupabase = async () => {
    setTestStatus('testing');
    try {
      supabaseService.initialize(localSettings.supabase.url, localSettings.supabase.anonKey);
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
      <div className="bg-[#FFFBF0] rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.1)] border-4 border-white p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative transform scale-100 animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-5 top-5 text-salmon hover:text-red-500 font-black text-xl bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center transition-transform hover:rotate-90"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-black text-slate-700 mb-1 flex items-center gap-2">
          <span className="text-3xl">⚙️</span> Settings
        </h2>
        <p className="text-sm text-slate-500 mb-6 font-semibold">
          Configure Supabase & AI providers
        </p>

        {/* Supabase Configuration */}
        <div className="mb-6 pb-6 border-b-2 border-slate-100">
          <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="text-xl">☁️</span> Supabase Cloud
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Supabase URL</label>
              <input 
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-sky-200 focus:ring-4 focus:ring-sky-50 transition-all placeholder:text-slate-200"
                placeholder="https://xxx.supabase.co"
                value={localSettings.supabase.url}
                onChange={e => updateSupabaseConfig('url', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Anon Key</label>
              <input 
                type="password"
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-sky-200 focus:ring-4 focus:ring-sky-50 transition-all placeholder:text-slate-200"
                placeholder="eyJhbGciOi..."
                value={localSettings.supabase.anonKey}
                onChange={e => updateSupabaseConfig('anonKey', e.target.value)}
              />
            </div>

            <button
              onClick={handleTestSupabase}
              disabled={!localSettings.supabase.url || !localSettings.supabase.anonKey}
              className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                testStatus === 'success' ? 'bg-green-100 text-green-600' :
                testStatus === 'failed' ? 'bg-red-100 text-red-600' :
                testStatus === 'testing' ? 'bg-yellow-100 text-yellow-600' :
                'bg-sky-100 text-sky-600 hover:bg-sky-200'
              }`}
            >
              {testStatus === 'success' ? '✓ Connected!' :
               testStatus === 'failed' ? '✗ Connection Failed' :
               testStatus === 'testing' ? 'Testing...' :
               'Test Connection'}
            </button>
          </div>
        </div>

        {/* AI Provider Tabs */}
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="text-xl">🤖</span> AI Providers
        </h3>

        <div className="flex gap-2 mb-6 p-1 bg-white rounded-2xl border border-slate-100 shadow-inner">
          {(['openai', 'deepseek', 'gemini'] as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => setViewProvider(p)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                viewProvider === p 
                  ? 'bg-sky-200 text-slate-700 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              } capitalize`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Base URL */}
          {viewProvider !== 'gemini' && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Base URL</label>
              <input 
                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-sky-200 focus:ring-4 focus:ring-sky-50 transition-all placeholder:text-slate-200"
                placeholder="https://..."
                value={currentConfig.baseUrl}
                onChange={e => updateProviderConfig('baseUrl', e.target.value)}
              />
            </div>
          )}

          {/* Model Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">Model Name</label>
            <input 
              className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-sky-200 focus:ring-4 focus:ring-sky-50 transition-all placeholder:text-slate-200"
              placeholder={viewProvider === 'gemini' ? "gemini-2.0-flash-exp" : viewProvider === 'deepseek' ? "deepseek-chat" : "gpt-4o"}
              value={currentConfig.model}
              onChange={e => updateProviderConfig('model', e.target.value)}
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 pl-2">API Key</label>
            <input 
              type="password"
              className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 focus:outline-none focus:border-sky-200 focus:ring-4 focus:ring-sky-50 transition-all placeholder:text-slate-200"
              placeholder="sk-..."
              value={currentConfig.apiKey}
              onChange={e => updateProviderConfig('apiKey', e.target.value)}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 mt-8">
          <button 
            onClick={() => {
              onSave(localSettings);
              onClose();
            }}
            className="w-full py-4 rounded-2xl bg-slate-800 text-white font-bold text-lg hover:bg-slate-700 hover:scale-[1.02] active:scale-95 shadow-cute hover:shadow-cute-hover transition-all flex items-center justify-center gap-2"
          >
            Save All <span className="text-xl">✨</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
