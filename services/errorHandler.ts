/**
 * Error Handler
 * 
 * Agent 错误处理和降级策略：
 * - 错误分类
 * - 重试策略
 * - 降级方案
 * - 用户友好的错误消息
 */

import { AgentError, AgentErrorType } from '../types/agent';

// ============================================
// Types
// ============================================

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟（毫秒） */
  initialDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 延迟倍数 */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
};

// ============================================
// Error Messages (Localized)
// ============================================

const ERROR_MESSAGES: Record<AgentErrorType, Record<string, string>> = {
  tool_not_found: {
    en: 'The requested tool is not available.',
    zh: '请求的工具不可用。',
    ja: 'リクエストされたツールは利用できません。'
  },
  tool_execution_failed: {
    en: 'Failed to execute the tool. Please try again.',
    zh: '工具执行失败，请重试。',
    ja: 'ツールの実行に失敗しました。もう一度お試しください。'
  },
  invalid_parameters: {
    en: 'Invalid parameters provided.',
    zh: '提供的参数无效。',
    ja: '無効なパラメータが指定されました。'
  },
  context_unavailable: {
    en: 'Page context is not available. Please navigate to a webpage.',
    zh: '页面上下文不可用，请导航到一个网页。',
    ja: 'ページコンテキストが利用できません。ウェブページに移動してください。'
  },
  llm_error: {
    en: 'AI service error. Please check your API key or try again later.',
    zh: 'AI 服务错误，请检查 API Key 或稍后重试。',
    ja: 'AIサービスエラー。APIキーを確認するか、後でもう一度お試しください。'
  },
  timeout: {
    en: 'Operation timed out. Please try again.',
    zh: '操作超时，请重试。',
    ja: '操作がタイムアウトしました。もう一度お試しください。'
  },
  aborted: {
    en: 'Operation was cancelled.',
    zh: '操作已取消。',
    ja: '操作がキャンセルされました。'
  },
  unknown: {
    en: 'An unexpected error occurred.',
    zh: '发生了意外错误。',
    ja: '予期しないエラーが発生しました。'
  }
};

// ============================================
// Error Handler Class
// ============================================

export class ErrorHandler {
  private language: string = 'en';
  
  /**
   * 设置语言
   */
  setLanguage(lang: string): void {
    this.language = lang;
  }
  
  /**
   * 分类错误
   */
  classifyError(error: any): AgentErrorType {
    const message = error instanceof Error ? error.message : String(error);
    const messageLower = message.toLowerCase();
    
    // 超时
    if (messageLower.includes('timeout') || messageLower.includes('timed out')) {
      return 'timeout';
    }
    
    // 中断
    if (messageLower.includes('abort') || messageLower.includes('cancel')) {
      return 'aborted';
    }
    
    // 工具未找到
    if (messageLower.includes('tool') && messageLower.includes('not found')) {
      return 'tool_not_found';
    }
    
    // 参数错误
    if (messageLower.includes('parameter') || messageLower.includes('invalid')) {
      return 'invalid_parameters';
    }
    
    // 上下文不可用
    if (messageLower.includes('context') && messageLower.includes('unavailable')) {
      return 'context_unavailable';
    }
    
    // LLM 错误
    if (messageLower.includes('api') || messageLower.includes('quota') || 
        messageLower.includes('rate limit') || messageLower.includes('429')) {
      return 'llm_error';
    }
    
    // 工具执行失败
    if (messageLower.includes('execution') || messageLower.includes('failed')) {
      return 'tool_execution_failed';
    }
    
    return 'unknown';
  }
  
  /**
   * 创建 Agent 错误
   */
  createAgentError(error: any, suggestions?: string[]): AgentError {
    const type = this.classifyError(error);
    const message = this.getErrorMessage(type);
    const originalMessage = error instanceof Error ? error.message : String(error);
    
    return {
      type,
      message,
      details: { originalMessage },
      recoverable: this.isRecoverable(type),
      suggestions: suggestions || this.getSuggestions(type)
    };
  }
  
  /**
   * 获取本地化错误消息
   */
  getErrorMessage(type: AgentErrorType): string {
    const messages = ERROR_MESSAGES[type];
    return messages[this.language] || messages['en'];
  }
  
  /**
   * 检查错误是否可恢复
   */
  isRecoverable(type: AgentErrorType): boolean {
    const nonRecoverable: AgentErrorType[] = ['aborted', 'invalid_parameters'];
    return !nonRecoverable.includes(type);
  }
  
  /**
   * 获取建议
   */
  getSuggestions(type: AgentErrorType): string[] {
    const suggestions: Record<AgentErrorType, string[]> = {
      tool_not_found: ['Check available tools', 'Try a different command'],
      tool_execution_failed: ['Try again', 'Use different parameters'],
      invalid_parameters: ['Check the required parameters', 'Provide valid values'],
      context_unavailable: ['Navigate to a webpage', 'Refresh the page'],
      llm_error: ['Check your API key', 'Try again later', 'Switch to a different model'],
      timeout: ['Try again', 'Use a simpler request'],
      aborted: ['Start a new operation'],
      unknown: ['Try again', 'Report this issue']
    };
    
    return suggestions[type] || suggestions.unknown;
  }
  
  /**
   * 带重试的执行
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const { maxRetries, initialDelay, maxDelay, backoffMultiplier } = {
      ...DEFAULT_RETRY_CONFIG,
      ...config
    };
    
    let lastError: any;
    let delay = initialDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // 检查是否应该重试
        const errorType = this.classifyError(error);
        if (!this.isRecoverable(errorType)) {
          throw error;
        }
        
        // 最后一次尝试不需要等待
        if (attempt < maxRetries) {
          await this.delay(delay);
          delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * 降级执行
   */
  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    shouldFallback?: (error: any) => boolean
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      // 检查是否应该降级
      if (shouldFallback && !shouldFallback(error)) {
        throw error;
      }
      
      console.warn('Primary operation failed, using fallback:', error);
      return await fallback();
    }
  }
  
  /**
   * 格式化错误用于显示
   */
  formatForDisplay(error: AgentError): string {
    let text = `⚠️ ${error.message}`;
    
    if (error.suggestions && error.suggestions.length > 0) {
      text += '\n\nSuggestions:';
      error.suggestions.forEach((s, i) => {
        text += `\n${i + 1}. ${s}`;
      });
    }
    
    return text;
  }
  
  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Singleton Instance
// ============================================

export const errorHandler = new ErrorHandler();

export default errorHandler;
