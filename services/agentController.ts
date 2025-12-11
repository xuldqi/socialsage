/**
 * Agent Controller
 * 
 * 核心控制器，协调所有 Agent 行为：
 * - 消息处理主流程
 * - 集成 IntentTracker, ContextManager, ExecutionEngine
 * - 工具调用和结果整合
 */

import {
  AgentContext,
  AgentState,
  AgentStatus,
  AgentStreamResponse,
  ProgressUpdate,
  Intent,
  ToolCall,
  ToolResult,
  ExecutionPlan,
  LLMAgentResponse
} from '../types/agent';
import { ChatMessage, MemoryItem, Persona, SocialPost, CapturedContext } from '../types';
import { contextManager, ContextManager } from './contextManager';
import { intentTracker, IntentTracker } from './intentTracker';
import { executionEngine, ExecutionEngine } from './executionEngine';
import { toolRegistry, createToolCallId } from './toolRegistry';
import { errorHandler } from './errorHandler';
import { registerBuiltinTools } from '../tools';
import { chatWithPage } from './geminiService';

// ============================================
// Types
// ============================================

export interface AgentControllerConfig {
  /** 是否显示推理过程 */
  showReasoning: boolean;
  /** 最大对话轮数 */
  maxConversationTurns: number;
  /** 输出语言 */
  outputLanguage: string;
}

const DEFAULT_CONFIG: AgentControllerConfig = {
  showReasoning: true,
  maxConversationTurns: 20,
  outputLanguage: 'en'
};

// ============================================
// Agent Controller Class
// ============================================

export class AgentController {
  private config: AgentControllerConfig;
  private state: AgentState;
  private contextManager: ContextManager;
  private intentTracker: IntentTracker;
  private executionEngine: ExecutionEngine;
  private abortController: AbortController | null = null;
  private initialized: boolean = false;
  
  constructor(config: Partial<AgentControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      status: 'idle',
      lastUpdated: Date.now()
    };
    this.contextManager = contextManager;
    this.intentTracker = intentTracker;
    this.executionEngine = executionEngine;
  }
  
  /**
   * 初始化 Agent
   */
  initialize(): void {
    if (this.initialized) return;
    
    // 注册内置工具
    registerBuiltinTools();
    
    // 设置错误处理器语言
    errorHandler.setLanguage(this.config.outputLanguage);
    
    this.initialized = true;
    console.log('[AgentController] Initialized');
  }
  
  /**
   * 处理用户消息（异步生成器）
   */
  async *processMessage(
    message: string,
    onProgress?: (update: ProgressUpdate) => void
  ): AsyncGenerator<AgentStreamResponse> {
    // 确保已初始化
    if (!this.initialized) {
      this.initialize();
    }
    
    // 设置状态
    this.updateState('thinking');
    this.abortController = new AbortController();
    
    try {
      // 1. 分析意图
      onProgress?.({ type: 'status', message: 'Analyzing intent...' });
      yield { type: 'thinking', content: 'Analyzing your request...' };
      
      const context = this.contextManager.buildContext(message);
      const intent = this.intentTracker.analyzeIntent(message, context.chatHistory);
      
      // 2. 检查是否是停止命令
      if (this.intentTracker.isStopCommand(message)) {
        this.abort();
        yield { type: 'message', content: 'Operation cancelled.' };
        yield { type: 'done' };
        return;
      }
      
      // 3. 根据意图决定处理方式
      if (intent.type === 'command' && intent.action) {
        // 需要执行工具
        yield* this.handleToolCommand(intent, context, onProgress);
      } else if (intent.type === 'query') {
        // 查询类问题
        yield* this.handleQuery(message, intent, context, onProgress);
      } else {
        // 普通对话
        yield* this.handleChat(message, context, onProgress);
      }
      
      yield { type: 'done' };
      
    } catch (error) {
      const agentError = errorHandler.createAgentError(error);
      yield { type: 'error', error: errorHandler.formatForDisplay(agentError) };
    } finally {
      this.updateState('idle');
      this.abortController = null;
    }
  }
  
  /**
   * 处理工具命令
   */
  private async *handleToolCommand(
    intent: Intent,
    context: AgentContext,
    onProgress?: (update: ProgressUpdate) => void
  ): AsyncGenerator<AgentStreamResponse> {
    // 查找工具
    const tool = toolRegistry.findByIntent(intent);
    
    if (!tool) {
      yield {
        type: 'message',
        content: `I couldn't find a tool for "${intent.action}". Available tools: ${toolRegistry.listNames().join(', ')}`
      };
      return;
    }
    
    // 显示工具调用
    onProgress?.({ type: 'tool', message: `Using ${tool.name}...`, toolName: tool.name });
    yield {
      type: 'thinking',
      content: `I'll use the ${tool.name} tool to help with this.`
    };
    
    // 准备参数
    const parameters = this.prepareToolParameters(tool.name, intent, context);
    
    // 创建工具调用
    const toolCall: ToolCall = {
      tool: tool.name,
      parameters,
      callId: createToolCallId()
    };
    
    yield { type: 'tool_call', toolCall };
    
    // 执行工具
    this.updateState('executing');
    const result = await toolRegistry.execute(toolCall, context);
    
    yield { type: 'tool_result', toolResult: result };
    
    // 生成响应
    if (result.success) {
      const response = result.displayText || JSON.stringify(result.data, null, 2);
      yield { type: 'message', content: response };
    } else {
      yield {
        type: 'message',
        content: `⚠️ ${result.error}\n\n${result.suggestions?.map(s => `• ${s}`).join('\n') || ''}`
      };
    }
  }
  
  /**
   * 处理查询
   */
  private async *handleQuery(
    message: string,
    intent: Intent,
    context: AgentContext,
    onProgress?: (update: ProgressUpdate) => void
  ): AsyncGenerator<AgentStreamResponse> {
    // 检查是否需要页面上下文
    const needsPageContext = 
      message.toLowerCase().includes('page') ||
      message.includes('页面') ||
      message.includes('ページ');
    
    if (needsPageContext && !context.pageContext) {
      yield {
        type: 'message',
        content: 'I don\'t have access to the current page. Please navigate to a webpage first.'
      };
      return;
    }
    
    onProgress?.({ type: 'status', message: 'Analyzing...' });
    
    try {
      
      // 构建上下文
      let pageContent = '';
      if (context.pageContext) {
        pageContent = `Current page: ${context.pageContext.metadata.title}\nURL: ${context.pageContext.metadata.url}\nContent: ${context.pageContext.mainContent.slice(0, 3000)}`;
      }
      
      // 检索相关记忆
      const memories = this.contextManager.retrieveRelevantMemories(message);
      if (memories.length > 0) {
        pageContent += `\n\nRelevant knowledge:\n${memories.map(m => `• ${m.content}`).join('\n')}`;
      }
      
      if (context.selection) {
        pageContent += `\n\nSelected text: "${context.selection}"`;
      }
      
      // 构建聊天历史
      const chatHistory = context.chatHistory.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      
      // 调用 Gemini API
      const response = await chatWithPage(
        message,
        pageContent || 'No context available.',
        'gemini-2.5-flash',
        { outputLanguage: this.config.outputLanguage },
        chatHistory
      );
      
      yield { type: 'message', content: response };
      
    } catch (error) {
      console.error('[AgentController] Query error:', error);
      yield {
        type: 'message',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error processing your query.'
      };
    }
  }
  
  /**
   * 处理普通对话
   */
  private async *handleChat(
    message: string,
    context: AgentContext,
    onProgress?: (update: ProgressUpdate) => void
  ): AsyncGenerator<AgentStreamResponse> {
    onProgress?.({ type: 'status', message: 'Generating response...' });
    
    try {
      
      // 构建上下文信息
      let pageContent = '';
      if (context.pageContext) {
        pageContent = `Current page: ${context.pageContext.metadata.title}\nURL: ${context.pageContext.metadata.url}\nContent: ${context.pageContext.mainContent.slice(0, 2000)}`;
      }
      if (context.selection) {
        pageContent += `\n\nSelected text: "${context.selection}"`;
      }
      
      // 构建聊天历史
      const chatHistory = context.chatHistory.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      
      // 调用 Gemini API
      const response = await chatWithPage(
        message,
        pageContent || 'No page context available.',
        'gemini-2.5-flash',
        { outputLanguage: this.config.outputLanguage },
        chatHistory
      );
      
      yield { type: 'message', content: response };
      
    } catch (error) {
      console.error('[AgentController] Chat error:', error);
      
      // 降级到简单响应
      const greetings = ['hello', 'hi', 'hey', '你好', 'こんにちは'];
      const isGreeting = greetings.some(g => message.toLowerCase().includes(g));
      
      if (isGreeting) {
        const responses: Record<string, string> = {
          en: "Hello! I'm your SocialSage assistant. I can help you summarize pages, extract data, generate replies, and more. What would you like to do?",
          zh: "你好！我是你的 SocialSage 助手。我可以帮你总结页面、提取数据、生成回复等。有什么需要帮忙的吗？",
          ja: "こんにちは！SocialSageアシスタントです。ページの要約、データ抽出、返信の生成などをお手伝いできます。何かお手伝いしましょうか？"
        };
        yield { type: 'message', content: responses[this.config.outputLanguage] || responses.en };
      } else {
        yield {
          type: 'message',
          content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again.'
        };
      }
    }
  }
  
  /**
   * 准备工具参数
   */
  private prepareToolParameters(
    toolName: string,
    intent: Intent,
    context: AgentContext
  ): Record<string, any> {
    const params: Record<string, any> = { ...intent.parameters };
    
    // 根据工具类型添加默认参数
    switch (toolName) {
      case 'summarize':
        if (!params.content && context.selection) {
          params.content = context.selection;
        }
        break;
        
      case 'extract_data':
        if (params.entityType === undefined && intent.parameters?.quoted?.[0]) {
          params.entityType = intent.parameters.quoted[0];
        }
        break;
        
      case 'generate_reply':
        if (!params.postContent && context.currentPost) {
          params.postContent = context.currentPost.content;
          params.postAuthor = context.currentPost.author;
          params.platform = context.currentPost.platform;
        }
        if (!params.personaId) {
          params.personaId = context.activePersonaId;
        }
        break;
        
      case 'search_memory':
        if (!params.query) {
          params.query = intent.rawMessage;
        }
        break;
    }
    
    return params;
  }
  
  /**
   * 更新状态
   */
  private updateState(status: AgentStatus): void {
    this.state = {
      ...this.state,
      status,
      lastUpdated: Date.now()
    };
  }
  
  /**
   * 中断执行
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.executionEngine.abort();
    this.updateState('idle');
  }
  
  /**
   * 获取当前状态
   */
  getState(): AgentState {
    return { ...this.state };
  }
  
  /**
   * 设置配置
   */
  setConfig(config: Partial<AgentControllerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.outputLanguage) {
      errorHandler.setLanguage(config.outputLanguage);
    }
  }
  
  // ============================================
  // Context Management Proxies
  // ============================================
  
  updatePageContext(context: CapturedContext): void {
    this.contextManager.updatePageContext(context);
  }
  
  updateSelection(text: string): void {
    this.contextManager.updateSelection(text);
  }
  
  setMemories(memories: MemoryItem[]): void {
    this.contextManager.setMemories(memories);
  }
  
  setPersonas(personas: Persona[]): void {
    this.contextManager.setPersonas(personas);
  }
  
  setActivePersonaId(id: string): void {
    this.contextManager.setActivePersonaId(id);
  }
  
  setCurrentPost(post: SocialPost | undefined): void {
    this.contextManager.setCurrentPost(post);
  }
  
  setChatHistory(history: ChatMessage[]): void {
    this.contextManager.setChatHistory(history);
  }
  
  addMessage(message: ChatMessage): void {
    this.contextManager.addMessage(message);
  }
  
  /**
   * 重置 Agent
   */
  reset(): void {
    this.abort();
    this.contextManager.reset();
    this.intentTracker.clear();
    this.executionEngine.reset();
    this.updateState('idle');
  }
}

// ============================================
// Singleton Instance
// ============================================

export const agentController = new AgentController();

export default agentController;
