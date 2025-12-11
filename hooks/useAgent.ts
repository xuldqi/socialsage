/**
 * useAgent Hook
 * 
 * React Hook 封装 Agent 功能：
 * - 消息处理
 * - 状态管理
 * - 上下文同步
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  AgentState, 
  AgentStreamResponse, 
  ProgressUpdate,
  ToolCall,
  ToolResult 
} from '../types/agent';
import { ChatMessage, MemoryItem, Persona, SocialPost, CapturedContext } from '../types';
import { agentController } from '../services/agentController';
import { contentScriptBridge } from '../services/contentScriptBridge';

// ============================================
// Types
// ============================================

export interface UseAgentOptions {
  /** 输出语言 */
  outputLanguage?: string;
  /** 是否显示推理过程 */
  showReasoning?: boolean;
  /** 初始记忆 */
  initialMemories?: MemoryItem[];
  /** 初始人设 */
  initialPersonas?: Persona[];
  /** 默认人设 ID */
  defaultPersonaId?: string;
}

export interface AgentMessage extends ChatMessage {
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  thought?: string;
  isStreaming?: boolean;
}

export interface UseAgentReturn {
  /** 消息列表 */
  messages: AgentMessage[];
  /** Agent 状态 */
  state: AgentState;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 当前进度 */
  progress: ProgressUpdate | null;
  /** 发送消息 */
  sendMessage: (content: string) => Promise<void>;
  /** 中断处理 */
  abort: () => void;
  /** 清除消息 */
  clearMessages: () => void;
  /** 更新页面上下文 */
  updatePageContext: (context: CapturedContext) => void;
  /** 更新选中文本 */
  updateSelection: (text: string) => void;
  /** 设置记忆 */
  setMemories: (memories: MemoryItem[]) => void;
  /** 设置人设 */
  setPersonas: (personas: Persona[]) => void;
  /** 设置当前帖子 */
  setCurrentPost: (post: SocialPost | undefined) => void;
  /** 重置 Agent */
  reset: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const {
    outputLanguage = 'en',
    showReasoning = true,
    initialMemories = [],
    initialPersonas = [],
    defaultPersonaId = ''
  } = options;
  
  // State
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [state, setState] = useState<AgentState>({ status: 'idle', lastUpdated: Date.now() });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  
  // Refs
  const abortRef = useRef(false);
  const initializedRef = useRef(false);
  
  // Initialize Agent
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    agentController.initialize();
    agentController.setConfig({ outputLanguage, showReasoning });
    
    if (initialMemories.length > 0) {
      agentController.setMemories(initialMemories);
    }
    if (initialPersonas.length > 0) {
      agentController.setPersonas(initialPersonas);
    }
    if (defaultPersonaId) {
      agentController.setActivePersonaId(defaultPersonaId);
    }
    
    // Setup page event listeners
    const unsubscribe = contentScriptBridge.onPageEvent((event) => {
      if (event.type === 'selection' && event.data?.text) {
        agentController.updateSelection(event.data.text);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Update config when options change
  useEffect(() => {
    agentController.setConfig({ outputLanguage, showReasoning });
  }, [outputLanguage, showReasoning]);
  
  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;
    
    abortRef.current = false;
    setIsProcessing(true);
    setProgress(null);
    
    // Add user message
    const userMessage: AgentMessage = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    agentController.addMessage(userMessage);
    
    // Create placeholder for assistant message
    const assistantMessageId = `msg_assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: AgentMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true
    };
    setMessages(prev => [...prev, assistantMessage]);
    
    try {
      // Process message with streaming
      const generator = agentController.processMessage(content, (update) => {
        setProgress(update);
      });
      
      let finalContent = '';
      let toolCall: ToolCall | undefined;
      let toolResult: ToolResult | undefined;
      let thought: string | undefined;
      
      for await (const response of generator) {
        if (abortRef.current) break;
        
        setState(agentController.getState());
        
        switch (response.type) {
          case 'thinking':
            thought = response.content;
            if (showReasoning) {
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, thought: response.content }
                  : m
              ));
            }
            break;
            
          case 'tool_call':
            toolCall = response.toolCall;
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, toolCall: response.toolCall }
                : m
            ));
            break;
            
          case 'tool_result':
            toolResult = response.toolResult;
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, toolResult: response.toolResult }
                : m
            ));
            break;
            
          case 'message':
            finalContent = response.content || '';
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, content: finalContent, isStreaming: false }
                : m
            ));
            break;
            
          case 'error':
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, content: response.error || 'An error occurred', isStreaming: false }
                : m
            ));
            break;
            
          case 'done':
            setMessages(prev => prev.map(m => 
              m.id === assistantMessageId 
                ? { ...m, isStreaming: false }
                : m
            ));
            break;
        }
      }
      
      // Add final message to agent context
      const finalMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now()
      };
      agentController.addMessage(finalMessage);
      
    } catch (error) {
      console.error('[useAgent] Error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { 
              ...m, 
              content: error instanceof Error ? error.message : 'An error occurred',
              isStreaming: false 
            }
          : m
      ));
    } finally {
      setIsProcessing(false);
      setProgress(null);
      setState(agentController.getState());
    }
  }, [isProcessing, showReasoning]);
  
  // Abort
  const abort = useCallback(() => {
    abortRef.current = true;
    agentController.abort();
    setIsProcessing(false);
    setProgress(null);
  }, []);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    agentController.setChatHistory([]);
  }, []);
  
  // Context updates
  const updatePageContext = useCallback((context: CapturedContext) => {
    agentController.updatePageContext(context);
  }, []);
  
  const updateSelection = useCallback((text: string) => {
    agentController.updateSelection(text);
  }, []);
  
  const setMemories = useCallback((memories: MemoryItem[]) => {
    agentController.setMemories(memories);
  }, []);
  
  const setPersonas = useCallback((personas: Persona[]) => {
    agentController.setPersonas(personas);
  }, []);
  
  const setCurrentPost = useCallback((post: SocialPost | undefined) => {
    agentController.setCurrentPost(post);
  }, []);
  
  // Reset
  const reset = useCallback(() => {
    agentController.reset();
    setMessages([]);
    setState({ status: 'idle', lastUpdated: Date.now() });
    setIsProcessing(false);
    setProgress(null);
  }, []);
  
  return {
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
    setCurrentPost,
    reset
  };
}

export default useAgent;
