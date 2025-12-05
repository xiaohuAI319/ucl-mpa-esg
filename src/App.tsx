import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderIcon, 
  FileTextIcon, 
  SendIcon, 
  SettingsIcon, 
  TrashIcon, 
  SparklesIcon,
  UploadIcon,
  DatabaseIcon,
} from './components/Icons';
import SettingsDialog from './components/SettingsDialog';
import { Folder, Message, AppSettings, Tab, AIProvider } from './types';
import { parseFile } from './services/fileService';
import { generateResponse, collectFileContext } from './services/gptService';
import { supabaseService } from './services/supabaseService';

// Constants
const INITIAL_MESSAGES: Message[] = [
  { 
    id: 'intro', 
    role: 'assistant', 
    content: "Hi friend! 🐻 I'm your UCL MPA study buddy. \n\nUpload your notes (DOCX/TXT/MD/PDF/PPT) to build your knowledge base, and I'll help you ace your ESG analysis!",
    timestamp: Date.now() 
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  activeProvider: 'deepseek',
  providers: {
    openai: {
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      apiKey: ''
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      apiKey: ''
    },
    gemini: {
      baseUrl: '',
      model: 'gemini-2.0-flash-exp',
      apiKey: ''
    }
  },
  supabase: {
    url: '',
    anonKey: ''
  }
};

function App() {
  // State
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [newFolderName, setNewFolderName] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Supabase
  useEffect(() => {
    const savedSettings = localStorage.getItem('ucl_mpa_settings_v2');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      
      if (parsed.supabase?.url && parsed.supabase?.anonKey) {
        supabaseService.initialize(parsed.supabase.url, parsed.supabase.anonKey);
        setIsSupabaseConnected(true);
        loadDataFromSupabase();
      }
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('ucl_mpa_settings_v2', JSON.stringify(settings));
  }, [settings]);

  // Auto scroll
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Load data from Supabase
  const loadDataFromSupabase = async () => {
    try {
      const foldersData = await supabaseService.getFolders();
      setFolders(foldersData);
      
      const conversationId = localStorage.getItem('current_conversation_id');
      if (conversationId) {
        const messagesData = await supabaseService.getMessages(conversationId);
        if (messagesData.length > 0) {
          setMessages([INITIAL_MESSAGES[0], ...messagesData]);
        }
      }
    } catch (err) {
      console.error('Failed to load data from Supabase:', err);
    }
  };

  // Actions
  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: newFolderName,
      files: []
    };
    
    if (isSupabaseConnected) {
      try {
        await supabaseService.createFolder(newFolder);
        setFolders([...folders, newFolder]);
      } catch (err) {
        console.error('Failed to create folder:', err);
        alert('Failed to create folder. Using local storage.');
        setFolders([...folders, newFolder]);
      }
    } else {
      setFolders([...folders, newFolder]);
    }
    
    setNewFolderName('');
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder? 🥺')) return;
    
    if (isSupabaseConnected) {
      try {
        await supabaseService.deleteFolder(folderId);
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    }
    
    setFolders(folders.filter(f => f.id !== folderId));
  };

  const handleFileUpload = async (folderId: string, files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    const processedFiles = await Promise.all(fileArray.map(parseFile));
    
    // Upload to Supabase if connected
    if (isSupabaseConnected) {
      for (const file of processedFiles) {
        try {
          await supabaseService.uploadDocument(folderId, file);
        } catch (err) {
          console.error('Failed to upload to Supabase:', err);
        }
      }
    }
    
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return { ...f, files: [...f.files, ...processedFiles] };
      }
      return f;
    }));
  };

  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear everything? This cannot be undone!')) return;
    
    setFolders([]);
    setMessages(INITIAL_MESSAGES);
    
    if (isSupabaseConnected) {
      try {
        // Clear Supabase data
        for (const folder of folders) {
          await supabaseService.deleteFolder(folder.id);
        }
      } catch (err) {
        console.error('Failed to clear Supabase data:', err);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const context = collectFileContext(folders);
      const activeConfig = settings.providers[settings.activeProvider];
      
      const result = await generateResponse(
        userMsg.content, 
        context, 
        settings.activeProvider, 
        activeConfig, 
        useSearch
      );
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
        groundingMetadata: result.groundingMetadata
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
      // Save to Supabase if connected
      if (isSupabaseConnected) {
        try {
          let conversationId = localStorage.getItem('current_conversation_id');
          if (!conversationId) {
            conversationId = Date.now().toString();
            await supabaseService.createConversation(conversationId, settings.activeProvider);
            localStorage.setItem('current_conversation_id', conversationId);
          }
          await supabaseService.saveMessage(conversationId, userMsg);
          await supabaseService.saveMessage(conversationId, aiMsg);
        } catch (err) {
          console.error('Failed to save messages to Supabase:', err);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🙈 Oops! Something went wrong: ${err.message}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({
      ...prev,
      activeProvider: e.target.value as AIProvider
    }));
  };

  const handleSettingsSave = (newSettings: AppSettings) => {
    setSettings(newSettings);
    
    // Reinitialize Supabase if credentials changed
    if (newSettings.supabase?.url && newSettings.supabase?.anonKey) {
      supabaseService.initialize(newSettings.supabase.url, newSettings.supabase.anonKey);
      setIsSupabaseConnected(true);
      loadDataFromSupabase();
    }
  };

  // Render Helpers
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') || line.startsWith('##')) {
         const content = line.replace(/\*\*/g, '').replace(/##/g, '').trim();
         return <div key={i} className="font-extrabold text-slate-800 mt-4 mb-2 text-base">{content}</div>;
      }
      if (line.trim() === '---') return <hr key={i} className="my-6 border-slate-200 border-dashed"/>;
      if (!line.trim()) return <div key={i} className="h-2"></div>;
      return <div key={i} className="text-slate-600 leading-7 mb-1 font-medium">{line}</div>;
    });
  };

  const renderGrounding = (metadata: any) => {
    if (!metadata || !metadata.groundingChunks) return null;
    
    const chunks = metadata.groundingChunks;
    return (
      <div className="mt-4 p-3 bg-sky-50 rounded-xl border border-sky-100 text-xs text-slate-600">
        <p className="font-bold mb-2 flex items-center gap-1">
          <span className="text-base">🌍</span> Sources found:
        </p>
        <div className="space-y-1">
          {chunks.map((chunk: any, i: number) => {
            if (chunk.web?.uri) {
               return (
                 <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="block truncate hover:text-sky-600 hover:underline">
                   {i+1}. {chunk.web.title || chunk.web.uri}
                 </a>
               );
            }
            return null;
          })}
        </div>
      </div>
    );
  };

  const activeApiKey = settings.providers[settings.activeProvider]?.apiKey;

  return (
    <div className="h-screen w-full flex items-center justify-center p-2 md:p-6 overflow-hidden">
      
      {/* Main Container Card */}
      <div className="w-full max-w-7xl h-full md:h-[95vh] bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-card border-4 border-white flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Sidebar */}
        <aside className="md:w-80 flex flex-col h-full bg-white/50 border-r-2 border-white">
          {/* Header */}
          <div className="p-6 pb-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-3xl p-5 shadow-lg shadow-indigo-200 transform hover:scale-[1.02] transition-transform duration-300">
               <div className="flex items-center gap-3 mb-1">
                 <span className="text-3xl filter drop-shadow-md">🎓</span>
                 <div>
                   <h1 className="font-black text-xl tracking-tight">UCL MPA</h1>
                   <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Study Buddy</p>
                 </div>
               </div>
               {/* Supabase Status */}
               <div className="mt-3 flex items-center gap-2 text-xs">
                 <DatabaseIcon className={`w-4 h-4 ${isSupabaseConnected ? 'text-green-300' : 'text-white/40'}`} />
                 <span className={`font-bold ${isSupabaseConnected ? 'text-white' : 'text-white/60'}`}>
                   {isSupabaseConnected ? 'Cloud Connected ✓' : 'Local Mode'}
                 </span>
               </div>
            </div>
          </div>

          {/* Tab Switcher (Mobile) */}
          <div className="md:hidden px-6 py-2 flex gap-2">
             <button onClick={() => setActiveTab('files')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'files' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}>Notes</button>
             <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2 rounded-xl font-bold text-sm ${activeTab === 'chat' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}>Chat</button>
          </div>

          {/* Files List */}
          <div className={`flex-1 overflow-y-auto px-6 py-2 ${activeTab === 'files' ? 'block' : 'hidden md:block'}`}>
             <div className="flex items-center justify-between mb-4 mt-2">
               <h2 className="font-extrabold text-slate-700 text-sm uppercase tracking-wider">My Bookshelf</h2>
               <span className="bg-orange-100 text-orange-500 text-[10px] font-black px-2 py-1 rounded-lg">
                 {folders.reduce((acc, f) => acc + f.files.length, 0)} DOCS
               </span>
             </div>

             <div className="space-y-4 pb-4">
               {/* New Folder Input */}
               <div className="flex gap-2">
                 <input 
                   value={newFolderName}
                   onChange={(e) => setNewFolderName(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                   placeholder="New subject..."
                   className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 text-sm font-bold text-slate-600 focus:outline-none focus:border-indigo-200 transition-all placeholder:text-slate-300 placeholder:font-normal"
                 />
                 <button onClick={handleAddFolder} className="bg-indigo-500 hover:bg-indigo-600 text-white w-10 rounded-2xl flex items-center justify-center font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">+</button>
               </div>

               {/* Folders */}
               {folders.map(folder => (
                 <div key={folder.id} className="bg-white rounded-2xl p-4 border-2 border-slate-50 shadow-sm hover:shadow-md hover:border-indigo-50 transition-all group">
                   <div className="flex justify-between items-center mb-3">
                     <div className="flex items-center gap-2">
                       <FolderIcon className="w-5 h-5 text-indigo-300" />
                       <span className="font-bold text-slate-700">{folder.name}</span>
                     </div>
                     <button onClick={() => handleDeleteFolder(folder.id)} className="text-rose-200 hover:text-rose-500 transition-colors">
                       <TrashIcon className="w-4 h-4" />
                     </button>
                   </div>
                   
                   <div className="space-y-2 mb-3">
                     {folder.files.map(file => (
                       <div key={file.id} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">
                         <FileTextIcon className="w-3 h-3 text-slate-400" />
                         <span className="truncate flex-1 font-medium">{file.name}</span>
                       </div>
                     ))}
                     {folder.files.length === 0 && <div className="text-[10px] text-slate-300 text-center py-2 font-medium">Empty folder</div>}
                   </div>

                   <label className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-indigo-100 rounded-xl text-xs font-bold text-indigo-300 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all">
                     <UploadIcon className="w-3.5 h-3.5" />
                     <span>Add Notes</span>
                     <input type="file" multiple accept=".txt,.md,.json,.csv,.docx,.pdf" className="hidden" onChange={(e) => handleFileUpload(folder.id, e.target.files)} />
                   </label>
                 </div>
               ))}
               
               {folders.length === 0 && (
                 <div className="text-center py-12 opacity-40">
                   <p className="text-4xl mb-2">📂</p>
                   <p className="text-sm font-bold text-slate-400">No folders yet!</p>
                 </div>
               )}
             </div>
          </div>

          {/* Footer controls */}
          <div className="p-6 pt-2 mt-auto flex gap-2">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-2xl font-bold text-xs hover:bg-slate-700 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-200"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </button>
            <button 
              onClick={handleClearData}
              className="px-4 bg-rose-100 text-rose-500 rounded-2xl hover:bg-rose-200 hover:scale-[1.05] transition-all"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Chat Area */}
        <main className={`flex-1 flex flex-col bg-[#FDF6E3]/30 relative ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Top Bar */}
          <div className="px-6 py-4 flex justify-between items-center border-b-2 border-white/50 bg-white/40 backdrop-blur-md sticky top-0 z-10">
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-yellow-400" />
                Analysis Chat
              </h2>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-0.5">
                <span className="uppercase tracking-wide">
                  GPT · Gemini · DeepSeek
                </span>
              </div>
            </div>

            {/* Toggle Search */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Web Search</span>
               <button 
                 onClick={() => setUseSearch(!useSearch)}
                 className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 relative ${useSearch ? 'bg-sky-400' : 'bg-slate-200'}`}
               >
                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${useSearch ? 'translate-x-4' : 'translate-x-0'}`}></div>
               </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`relative max-w-[85%] lg:max-w-[75%] rounded-[1.5rem] p-6 shadow-sm ${
                   msg.role === 'user' 
                     ? 'bg-slate-800 text-white rounded-br-none shadow-slate-200' 
                     : 'bg-white text-slate-700 border-2 border-white shadow-card rounded-bl-none'
                }`}>
                   {/* Avatar Decoration */}
                   <div className={`absolute -bottom-6 ${msg.role === 'user' ? '-right-2' : '-left-2'} text-2xl`}>
                     {msg.role === 'user' ? '🧑‍🎓' : '🐻'}
                   </div>

                   {msg.role === 'user' ? (
                     <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                   ) : (
                     <div className="text-sm">
                       {renderMarkdown(msg.content)}
                       {renderGrounding(msg.groundingMetadata)}
                     </div>
                   )}
                   
                   <div className={`text-[10px] mt-3 font-bold opacity-40 ${msg.role === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                     {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start w-full pl-2">
                 <div className="bg-white rounded-2xl rounded-bl-none p-4 border-2 border-white shadow-sm flex items-center gap-2">
                   <div className="w-2.5 h-2.5 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-2.5 h-2.5 bg-sky-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-2.5 h-2.5 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 bg-white/40 backdrop-blur-md">
            
            {/* Model Selector Pill */}
            <div className="flex justify-end mb-2 px-1">
               <div className="relative inline-block">
                 <select 
                   value={settings.activeProvider}
                   onChange={handleProviderSwitch}
                   className="appearance-none bg-white border-2 border-white shadow-sm rounded-xl py-1.5 pl-4 pr-10 text-xs font-bold text-slate-600 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:bg-slate-50 cursor-pointer"
                 >
                   <option value="openai">OpenAI</option>
                   <option value="gemini">Gemini</option>
                   <option value="deepseek">DeepSeek</option>
                 </select>
                 <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                   ▼
                 </div>
               </div>
            </div>

            <div className="relative flex items-end gap-2 bg-white border-2 border-white rounded-[2rem] p-2 shadow-card focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all">
              <textarea 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={activeApiKey ? `Ask ${settings.activeProvider}...` : "Ask me (Demo Mode)..."}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[50px] py-3 px-4 text-sm font-medium text-slate-700 placeholder:text-slate-300"
                rows={1}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className={`mb-1 mr-1 p-3 rounded-full transition-all duration-300 ${
                  !inputValue.trim() || isLoading 
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                    : 'bg-indigo-500 text-white hover:bg-indigo-600 hover:shadow-lg hover:scale-110 active:scale-95 shadow-indigo-200'
                }`}
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

        </main>
      </div>

      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSettingsSave}
      />
    </div>
  );
}

export default App;
