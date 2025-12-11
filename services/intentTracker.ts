/**
 * Intent Tracker
 * 
 * 追踪多轮对话中的用户意图：
 * - 意图分析
 * - 引用解析
 * - 意图状态管理
 */

import { Intent, IntentType, ResolvedReference, AgentContext } from '../types/agent';
import { ChatMessage } from '../types';

// ============================================
// Intent Patterns
// ============================================

/** 动作关键词映射 */
const ACTION_KEYWORDS: Record<string, string[]> = {
  summarize: ['summarize', 'summary', 'tldr', '总结', '概括', '摘要', '要約', 'まとめ'],
  extract: ['extract', 'get', 'find', 'scrape', '提取', '抓取', '获取', '抽出'],
  reply: ['reply', 'respond', 'answer', '回复', '回答', '返信'],
  translate: ['translate', '翻译', '翻訳'],
  explain: ['explain', 'what is', 'what does', '解释', '什么是', '説明'],
  search: ['search', 'find', 'look for', '搜索', '查找', '検索'],
  help: ['help', 'how to', 'how do', '帮助', '怎么', 'ヘルプ'],
  create: ['create', 'make', 'generate', '创建', '生成', '作成'],
  delete: ['delete', 'remove', '删除', '移除', '削除'],
  stop: ['stop', 'cancel', 'abort', '停止', '取消', '中止']
};

/** 目标关键词映射 */
const TARGET_KEYWORDS: Record<string, string[]> = {
  page: ['page', 'this page', 'current page', '页面', '当前页面', 'このページ'],
  selection: ['selection', 'selected', 'highlighted', '选中', '选择的', '選択'],
  post: ['post', 'tweet', 'this post', '帖子', '这条', 'この投稿'],
  memory: ['memory', 'knowledge', '记忆', '知识库', 'メモリ'],
  rule: ['rule', 'rules', '规则', 'ルール'],
  persona: ['persona', 'style', '人设', '风格', 'ペルソナ']
};

/** 引用词映射 */
const REFERENCE_WORDS: Record<string, string[]> = {
  previous: ['it', 'that', 'this', '它', '那个', '这个', '刚才', 'それ', 'これ'],
  page: ['the page', 'this page', '这个页面', 'このページ'],
  selection: ['the selection', 'selected text', '选中的', '選択したテキスト']
};

// ============================================
// Intent Tracker Class
// ============================================

export class IntentTracker {
  private currentIntent: Intent | null = null;
  private intentHistory: Intent[] = [];
  private maxHistory: number = 10;
  
  /**
   * 分析用户消息的意图
   */
  analyzeIntent(message: string, history: ChatMessage[]): Intent {
    const messageLower = message.toLowerCase();
    
    // 检测意图类型
    const type = this.detectIntentType(messageLower, history);
    
    // 检测动作
    const action = this.detectAction(messageLower);
    
    // 检测目标
    const target = this.detectTarget(messageLower);
    
    // 提取参数
    const parameters = this.extractParameters(message, action);
    
    // 计算置信度
    const confidence = this.calculateConfidence(type, action, target);
    
    const intent: Intent = {
      type,
      action,
      target,
      parameters,
      confidence,
      rawMessage: message
    };
    
    // 更新当前意图
    this.updateIntent(intent);
    
    return intent;
  }
  
  /**
   * 检测意图类型
   */
  private detectIntentType(message: string, history: ChatMessage[]): IntentType {
    // 确认类意图
    if (/^(yes|ok|sure|好|是|对|確認|はい)/i.test(message)) {
      return 'confirmation';
    }
    
    // 澄清类意图
    if (/^(what|which|how|为什么|什么|哪个|なぜ|何)/i.test(message) && message.length < 50) {
      // 如果是简短的疑问，可能是澄清
      if (history.length > 0) {
        return 'clarification';
      }
    }
    
    // 命令类意图
    const hasAction = Object.values(ACTION_KEYWORDS).some(keywords =>
      keywords.some(kw => message.includes(kw))
    );
    if (hasAction) {
      return 'command';
    }
    
    // 查询类意图
    if (/\?|？|what|how|why|when|where|who|是什么|怎么|为什么/.test(message)) {
      return 'query';
    }
    
    // 默认为聊天
    return 'chat';
  }
  
  /**
   * 检测动作
   */
  private detectAction(message: string): string | undefined {
    for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
      if (keywords.some(kw => message.includes(kw))) {
        return action;
      }
    }
    return undefined;
  }
  
  /**
   * 检测目标
   */
  private detectTarget(message: string): string | undefined {
    for (const [target, keywords] of Object.entries(TARGET_KEYWORDS)) {
      if (keywords.some(kw => message.includes(kw))) {
        return target;
      }
    }
    return undefined;
  }
  
  /**
   * 提取参数
   */
  private extractParameters(message: string, action?: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    // 提取数字参数
    const numbers = message.match(/\d+/g);
    if (numbers) {
      params.numbers = numbers.map(n => parseInt(n, 10));
    }
    
    // 提取引号内的内容
    const quoted = message.match(/["'「」『』]([^"'「」『』]+)["'「」『』]/g);
    if (quoted) {
      params.quoted = quoted.map(q => q.slice(1, -1));
    }
    
    // 根据动作提取特定参数
    if (action === 'extract') {
      // 检测实体类型
      const entityTypes = ['email', 'phone', 'url', 'price', '邮箱', '电话', '链接'];
      for (const type of entityTypes) {
        if (message.toLowerCase().includes(type)) {
          params.entityType = type.replace('邮箱', 'email').replace('电话', 'phone').replace('链接', 'url');
          break;
        }
      }
    }
    
    return params;
  }
  
  /**
   * 计算置信度
   */
  private calculateConfidence(type: IntentType, action?: string, target?: string): number {
    let confidence = 0.5;
    
    // 有明确动作增加置信度
    if (action) confidence += 0.2;
    
    // 有明确目标增加置信度
    if (target) confidence += 0.15;
    
    // 命令类型通常更确定
    if (type === 'command') confidence += 0.1;
    
    // 确认类型最确定
    if (type === 'confirmation') confidence = 0.95;
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * 解析引用
   */
  resolveReference(reference: string, context: AgentContext): ResolvedReference {
    const refLower = reference.toLowerCase();
    
    // 检查是否是页面引用
    if (REFERENCE_WORDS.page.some(w => refLower.includes(w))) {
      if (context.pageContext?.mainContent) {
        return {
          resolved: context.pageContext.mainContent,
          type: 'page',
          original: reference
        };
      }
    }
    
    // 检查是否是选中文本引用
    if (REFERENCE_WORDS.selection.some(w => refLower.includes(w))) {
      if (context.selection) {
        return {
          resolved: context.selection,
          type: 'selection',
          original: reference
        };
      }
    }
    
    // 检查是否是前文引用
    if (REFERENCE_WORDS.previous.some(w => refLower.includes(w))) {
      // 查找最近的相关内容
      const recentMessages = context.chatHistory.slice(-5);
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i];
        if (msg.role === 'assistant' && msg.content.length > 20) {
          return {
            resolved: msg.content,
            type: 'previous_message',
            original: reference
          };
        }
      }
    }
    
    // 无法解析
    return {
      resolved: reference,
      type: 'unknown',
      original: reference
    };
  }
  
  /**
   * 获取当前意图
   */
  getCurrentIntent(): Intent | null {
    return this.currentIntent;
  }
  
  /**
   * 更新意图
   */
  private updateIntent(intent: Intent): void {
    this.currentIntent = intent;
    this.intentHistory.push(intent);
    
    // 限制历史长度
    if (this.intentHistory.length > this.maxHistory) {
      this.intentHistory = this.intentHistory.slice(-this.maxHistory);
    }
  }
  
  /**
   * 获取意图历史
   */
  getIntentHistory(): Intent[] {
    return [...this.intentHistory];
  }
  
  /**
   * 清除意图状态
   */
  clear(): void {
    this.currentIntent = null;
    this.intentHistory = [];
  }
  
  /**
   * 检查是否是停止命令
   */
  isStopCommand(message: string): boolean {
    const stopWords = ACTION_KEYWORDS.stop;
    return stopWords.some(w => message.toLowerCase().includes(w));
  }
  
  /**
   * 检查是否是确认
   */
  isConfirmation(message: string): boolean {
    const confirmWords = ['yes', 'ok', 'sure', 'confirm', '好', '是', '对', '确认', 'はい', '確認'];
    return confirmWords.some(w => message.toLowerCase().includes(w));
  }
  
  /**
   * 检查是否是否定
   */
  isNegation(message: string): boolean {
    const negationWords = ['no', 'cancel', 'stop', '不', '否', '取消', 'いいえ', 'キャンセル'];
    return negationWords.some(w => message.toLowerCase().includes(w));
  }
}

// ============================================
// Singleton Instance
// ============================================

export const intentTracker = new IntentTracker();

export default intentTracker;
