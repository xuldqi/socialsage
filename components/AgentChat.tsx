/**
 * Agent Chat Component
 * 
 * 使用新 Agent 系统的聊天组件：
 * - 集成 useAgent hook
 * - 显示工具调用和结果
 * - 支持中断和重新生成
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAgent, AgentMessage } from '../hooks/useAgent';
import { ToolResultDisplay, ToolCallDisplay, ThinkingDisplay } from './ToolResultDisplay';
import { SendIcon, StopIcon, RefreshIcon, CopyIcon, EditIcon, TrashIcon, SparklesIcon } from './Icons';
import { MemoryItem, Persona, SocialPost, CapturedContext, UserSettings } from '../types';

// ============================================
// Types
// ============================================

interface AgentChatProps {
  settings: UserSettings;
  memories: MemoryItem[];
  personas: Persona[];
  defaultPersonaId: string;
  pageContext?: CapturedContext;
  currentPost?: SocialPost;
  selection?: string;
  onAddSystemLog?: (action: string, details: string, source?: 'User' | 'AI Agent' | 'Auto-Pilot') => void;
}

// ============================================
// Translations
// ============================================

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    placeholder: "Ask anything (e.g. 'Summarize this page', 'Extract emails')...",
    send: "Send",
    stop: "Stop",
    thinking: "Thinking...",
    processing: "Processing...",
    copy: "Copy",
    edit: "Edit",
    regenerate: "Regenerate",
    clear: "Clear chat",
    welcome: "Hello! I'm your SocialSage assistant. I can help you:\n• Summarize pages and content\n• Extract data (emails, links, etc.)\n• Generate replies with your personas\n• Search your knowledge base\n\nWhat would you like to do?"
  },
  zh: {
    placeholder: "随便问（如：总结这个页面、提取邮箱）...",
    send: "发送",
    stop: "停止",
    thinking: "思考中...",
    processing: "处理中...",
    copy: "复制",
    edit: "编辑",
    regenerate: "重新生成",
    clear: "清空对话",
    welcome: "你好！我是你的 SocialSage 助手。我可以帮你：\n• 总结页面和内容\n• 提取数据（邮箱、链接等）\n• 用你的人设生成回复\n• 搜索知识库\n\n有什么需要帮忙的吗？"
  },
  ja: {
    placeholder: "何でも聞いてください（例：このページを要約、メールを抽出）...",
    send: "送信",
    stop: "停止",
    thinking: "考え中...",
    processing: "処理中...",
    copy: "コピー",
    edit: "編集",
    regenerate: "再生成",
    clear: "チャットをクリア",
    welcome: "こんにちは！SocialSageアシスタントです。お手伝いできること：\n• ページやコンテンツの要約\n• データ抽出（メール、リンクなど）\n• ペルソナを使った返信生成\n• ナレッジベースの検索\n\n何かお手伝いしましょうか？"
  }
};

// ============================================
// Component
// ============================================

export const AgentChat: React.FC<AgentChatProps> = ({
  settings,
  memories,
  personas,
  defaultPersonaId,
  pageContext,
  currentPost,
  selection,
  onAddSystemLog
}) => {
  const [input, setInput] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // 使用 Agent hook
  const {
    messages,
    state,
    isProcessing,
    progress,
    sendMessage,
    abort,
    clearMessages,
    updatePageContext,
    updateSelection,
    setMemories,
    setPersonas,
    setCurrentPost
  } = useAgent({
    outputLanguage: settings.language,
    showReasoning: true,
    initialMemories: memories,
    initialPersonas: personas,
    defaultPersonaId
  });
  
  // 翻译函数
  const t = (key: string) => {
    return TRANSLATIONS[settings.language]?.[key] || TRANSLATIONS['en'][key] || key;
  };
  
  // 同步上下文
  useEffect(() => {
    if (pageContext) updatePageContext(pageContext);
  }, [pageContext]);
  
  useEffect(() => {
    if (selection) updateSelection(selection);
  }, [selection]);
  
  useEffect(() => {
    setMemories(memories);
  }, [memories]);
  
  useEffect(() => {
    setPersonas(personas);
  }, [personas]);
  
  useEffect(() => {
    setCurrentPost(currentPost);
  }, [currentPost]);
  
  // 自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 自动调整输入框高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);
  
  // 发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    setShowWelcome(false);
    const message = input;
    setInput('');
    
    onAddSystemLog?.('User Message', message.slice(0, 50) + '...', 'User');
    await sendMessage(message);
  };
  
  // 复制消息
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    onAddSystemLog?.('Copy', 'Copied message to clipboard', 'User');
  };
  
  // 清空对话
  const handleClear = () => {
    clearMessages();
    setShowWelcome(true);
    onAddSystemLog?.('Clear Chat', 'Cleared chat history', 'User');
  };
  
  // 渲染消息
  const renderMessage = (msg: AgentMessage, index: number) => {
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';
    
    return (
      <div
        key={msg.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-indigo-600 text-white'
              : isSystem
                ? 'bg-amber-50 text-amber-800 border border-amber-100'
                : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          {/* 思考过程 */}
          {msg.thought && !isUser && (
            <ThinkingDisplay thought={msg.thought} />
          )}
          
          {/* 工具调用 */}
          {msg.toolCall && (
            <ToolCallDisplay toolCall={msg.toolCall} />
          )}
          
          {/* 工具结果 */}
          {msg.toolResult && (
            <ToolResultDisplay 
              toolCall={msg.toolCall} 
              result={msg.toolResult}
              compact={true}
            />
          )}
          
          {/* 消息内容 */}
          {msg.content && (
            <div className="whitespace-pre-wrap text-sm">
              {msg.isStreaming && !msg.content ? (
                <span className="animate-pulse">{t('thinking')}</span>
              ) : (
                msg.content
              )}
            </div>
          )}
          
          {/* 操作按钮 */}
          {!isUser && !isSystem && msg.content && !msg.isStreaming && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleCopy(msg.content)}
                className="text-slate-400 hover:text-slate-600 p-1"
                title={t('copy')}
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-slate-700">Agent Chat</span>
          {isProcessing && (
            <span className="text-xs text-indigo-500 animate-pulse">
              {progress?.message || t('processing')}
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-slate-400 hover:text-slate-600 text-xs"
          title={t('clear')}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 欢迎消息 */}
        {showWelcome && messages.length === 0 && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 mb-4 border border-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-5 h-5 text-indigo-500" />
              <span className="font-medium text-indigo-700">SocialSage Agent</span>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-line">
              {t('welcome')}
            </p>
          </div>
        )}
        
        {/* 消息 */}
        {messages.map((msg, index) => renderMessage(msg, index))}
        
        {/* 滚动锚点 */}
        <div ref={chatEndRef} />
      </div>
      
      {/* 输入区域 */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={t('placeholder')}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={isProcessing}
          />
          
          {isProcessing ? (
            <button
              type="button"
              onClick={abort}
              className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              title={t('stop')}
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              title={t('send')}
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
