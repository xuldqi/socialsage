/**
 * Context Manager
 * 
 * 管理 Agent 的所有上下文信息：
 * - 页面上下文
 * - 用户选中文本
 * - 记忆检索
 * - 对话历史
 */

import { AgentContext } from '../types/agent';
import { CapturedContext, ChatMessage, MemoryItem, Persona, SocialPost } from '../types';
import { calculateSimilarity } from '../tools/searchMemoryTool';

// ============================================
// Types
// ============================================

export interface ContextManagerConfig {
  /** 最大对话历史长度 */
  maxChatHistory: number;
  /** 最大相关记忆数量 */
  maxRelevantMemories: number;
  /** 记忆相关性阈值 */
  memoryRelevanceThreshold: number;
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxChatHistory: 20,
  maxRelevantMemories: 5,
  memoryRelevanceThreshold: 0.1
};

// ============================================
// Context Manager Class
// ============================================

export class ContextManager {
  private config: ContextManagerConfig;
  
  // 状态
  private pageContext: CapturedContext | undefined;
  private selection: string | undefined;
  private chatHistory: ChatMessage[] = [];
  private memories: MemoryItem[] = [];
  private personas: Persona[] = [];
  private activePersonaId: string = '';
  private currentPost: SocialPost | undefined;
  
  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================
  // Page Context
  // ============================================
  
  /**
   * 更新页面上下文
   */
  updatePageContext(context: CapturedContext): void {
    this.pageContext = context;
  }
  
  /**
   * 获取页面上下文
   */
  getPageContext(): CapturedContext | undefined {
    return this.pageContext;
  }
  
  /**
   * 清除页面上下文
   */
  clearPageContext(): void {
    this.pageContext = undefined;
  }
  
  /**
   * 检查是否有页面上下文
   */
  hasPageContext(): boolean {
    return this.pageContext !== undefined;
  }
  
  // ============================================
  // Selection
  // ============================================
  
  /**
   * 更新选中文本
   */
  updateSelection(text: string): void {
    this.selection = text;
  }
  
  /**
   * 获取选中文本
   */
  getSelection(): string | undefined {
    return this.selection;
  }
  
  /**
   * 清除选中文本
   */
  clearSelection(): void {
    this.selection = undefined;
  }
  
  // ============================================
  // Chat History
  // ============================================
  
  /**
   * 添加消息到对话历史
   */
  addMessage(message: ChatMessage): void {
    this.chatHistory.push(message);
    
    // 限制历史长度
    if (this.chatHistory.length > this.config.maxChatHistory) {
      this.chatHistory = this.chatHistory.slice(-this.config.maxChatHistory);
    }
  }
  
  /**
   * 获取对话历史
   */
  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }
  
  /**
   * 获取最近 N 条消息
   */
  getRecentMessages(count: number): ChatMessage[] {
    return this.chatHistory.slice(-count);
  }
  
  /**
   * 清除对话历史
   */
  clearChatHistory(): void {
    this.chatHistory = [];
  }
  
  /**
   * 设置完整对话历史
   */
  setChatHistory(history: ChatMessage[]): void {
    this.chatHistory = history.slice(-this.config.maxChatHistory);
  }
  
  // ============================================
  // Memory Management
  // ============================================
  
  /**
   * 设置记忆列表
   */
  setMemories(memories: MemoryItem[]): void {
    this.memories = memories;
  }
  
  /**
   * 获取所有记忆
   */
  getMemories(): MemoryItem[] {
    return this.memories;
  }
  
  /**
   * 检索相关记忆
   */
  retrieveRelevantMemories(query: string, limit?: number): MemoryItem[] {
    const maxResults = limit || this.config.maxRelevantMemories;
    
    if (this.memories.length === 0 || !query.trim()) {
      return [];
    }
    
    // 计算每个记忆的相关性分数
    const scored = this.memories.map(memory => ({
      memory,
      score: this.calculateRelevance(query, memory.content)
    }));
    
    // 过滤低相关性的记忆
    const relevant = scored.filter(s => s.score >= this.config.memoryRelevanceThreshold);
    
    // 按分数排序并返回
    return relevant
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(s => s.memory);
  }
  
  /**
   * 计算查询与内容的相关性
   */
  private calculateRelevance(query: string, content: string): number {
    // 使用 Jaccard 相似度
    return calculateSimilarity(query, content);
  }
  
  // ============================================
  // Persona Management
  // ============================================
  
  /**
   * 设置人设列表
   */
  setPersonas(personas: Persona[]): void {
    this.personas = personas;
  }
  
  /**
   * 获取所有人设
   */
  getPersonas(): Persona[] {
    return this.personas;
  }
  
  /**
   * 设置当前激活的人设
   */
  setActivePersonaId(id: string): void {
    this.activePersonaId = id;
  }
  
  /**
   * 获取当前激活的人设
   */
  getActivePersona(): Persona | undefined {
    return this.personas.find(p => p.id === this.activePersonaId);
  }
  
  // ============================================
  // Current Post
  // ============================================
  
  /**
   * 设置当前帖子上下文
   */
  setCurrentPost(post: SocialPost | undefined): void {
    this.currentPost = post;
  }
  
  /**
   * 获取当前帖子
   */
  getCurrentPost(): SocialPost | undefined {
    return this.currentPost;
  }
  
  // ============================================
  // Build Complete Context
  // ============================================
  
  /**
   * 构建完整的 Agent 上下文
   */
  buildContext(query?: string): AgentContext {
    // 如果有查询，检索相关记忆
    const relevantMemories = query 
      ? this.retrieveRelevantMemories(query)
      : this.memories.slice(0, this.config.maxRelevantMemories);
    
    return {
      chatHistory: this.getChatHistory(),
      pageContext: this.pageContext,
      selection: this.selection,
      memories: relevantMemories,
      personas: this.personas,
      activePersonaId: this.activePersonaId,
      currentPost: this.currentPost
    };
  }
  
  /**
   * 构建用于 LLM 的上下文字符串
   */
  buildContextString(query?: string): string {
    const parts: string[] = [];
    
    // 页面信息
    if (this.pageContext) {
      parts.push(`[Current Page]`);
      parts.push(`URL: ${this.pageContext.metadata.url}`);
      parts.push(`Title: ${this.pageContext.metadata.title}`);
      if (this.pageContext.mainContent) {
        const content = this.pageContext.mainContent.slice(0, 500);
        parts.push(`Content Preview: ${content}${this.pageContext.mainContent.length > 500 ? '...' : ''}`);
      }
      parts.push('');
    }
    
    // 选中文本
    if (this.selection) {
      parts.push(`[Selected Text]`);
      parts.push(this.selection);
      parts.push('');
    }
    
    // 当前帖子
    if (this.currentPost) {
      parts.push(`[Current Post]`);
      parts.push(`Author: ${this.currentPost.author}`);
      parts.push(`Content: ${this.currentPost.content}`);
      parts.push(`Platform: ${this.currentPost.platform}`);
      parts.push('');
    }
    
    // 相关记忆
    const memories = query 
      ? this.retrieveRelevantMemories(query)
      : this.memories.slice(0, 3);
    
    if (memories.length > 0) {
      parts.push(`[Relevant Knowledge]`);
      memories.forEach((m, i) => {
        parts.push(`${i + 1}. ${m.content}`);
      });
      parts.push('');
    }
    
    return parts.join('\n');
  }
  
  // ============================================
  // State Management
  // ============================================
  
  /**
   * 重置所有状态
   */
  reset(): void {
    this.pageContext = undefined;
    this.selection = undefined;
    this.chatHistory = [];
    this.currentPost = undefined;
  }
  
  /**
   * 导出状态（用于持久化）
   */
  exportState(): object {
    return {
      chatHistory: this.chatHistory,
      activePersonaId: this.activePersonaId
    };
  }
  
  /**
   * 导入状态
   */
  importState(state: any): void {
    if (state.chatHistory) {
      this.chatHistory = state.chatHistory;
    }
    if (state.activePersonaId) {
      this.activePersonaId = state.activePersonaId;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

export const contextManager = new ContextManager();

export default contextManager;
