/**
 * Content Script Bridge
 * 
 * Sidebar 与 Content Script 之间的通信桥梁：
 * - 请求页面上下文
 * - 执行页面操作
 * - 监听页面事件
 * - 连接状态管理
 */

import { CapturedContext } from '../types';
import {
  PageAction,
  ActionResult,
  PageEvent,
  ContentScriptConnectionState,
  SidebarMessage,
  ContentScriptMessage,
  MessageResponse
} from '../types/messaging';

// ============================================
// Types
// ============================================

declare const chrome: any;

export interface BridgeConfig {
  /** Ping 超时时间（毫秒） */
  pingTimeout: number;
  /** 消息超时时间（毫秒） */
  messageTimeout: number;
  /** 重连间隔（毫秒） */
  reconnectInterval: number;
}

const DEFAULT_CONFIG: BridgeConfig = {
  pingTimeout: 1000,
  messageTimeout: 5000,
  reconnectInterval: 3000
};

// ============================================
// Content Script Bridge Class
// ============================================

export class ContentScriptBridge {
  private config: BridgeConfig;
  private connectionState: ContentScriptConnectionState = {
    connected: false
  };
  private eventListeners: Map<string, Set<(event: PageEvent) => void>> = new Map();
  private messageIdCounter: number = 0;
  
  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupMessageListener();
  }
  
  /**
   * 设置消息监听器
   */
  private setupMessageListener(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      console.warn('[Bridge] Chrome runtime not available');
      return;
    }
    
    chrome.runtime.onMessage.addListener(
      (message: ContentScriptMessage, sender: any, sendResponse: any) => {
        this.handleMessage(message);
        return false; // 不需要异步响应
      }
    );
  }
  
  /**
   * 处理来自 Content Script 的消息
   */
  private handleMessage(message: ContentScriptMessage): void {
    switch (message.type) {
      case 'SELECTION_CHANGE':
        this.emitEvent({ type: 'selection', data: message.payload, timestamp: message.timestamp });
        break;
      case 'NAVIGATION':
        this.emitEvent({ type: 'navigation', data: message.payload, timestamp: message.timestamp });
        // 导航时重置连接状态
        this.connectionState.currentUrl = message.payload.url;
        break;
      case 'DOM_MUTATION':
        if (message.payload.isSignificant) {
          this.emitEvent({ type: 'mutation', data: message.payload, timestamp: message.timestamp });
        }
        break;
      case 'FOCUS_CHANGE':
        this.emitEvent({ type: 'focus', data: message.payload, timestamp: message.timestamp });
        break;
      case 'PONG':
        this.connectionState.connected = true;
        this.connectionState.lastPing = Date.now();
        this.connectionState.version = message.payload.version;
        this.connectionState.currentUrl = message.payload.url;
        break;
    }
  }
  
  /**
   * 发送消息到 Content Script
   */
  private async sendMessage<T>(message: SidebarMessage): Promise<MessageResponse<T>> {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return { success: false, error: 'Chrome API not available' };
    }
    
    return new Promise((resolve) => {
      // 获取当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (!tabs || tabs.length === 0 || !tabs[0].id) {
          resolve({ success: false, error: 'No active tab found' });
          return;
        }
        
        const tabId = tabs[0].id;
        
        // 设置超时
        const timeoutId = setTimeout(() => {
          resolve({ success: false, error: 'Message timeout' });
        }, this.config.messageTimeout);
        
        // 发送消息
        chrome.tabs.sendMessage(tabId, message, (response: any) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            resolve({ 
              success: false, 
              error: chrome.runtime.lastError.message || 'Failed to send message'
            });
            return;
          }
          
          resolve({ success: true, data: response });
        });
      });
    });
  }
  
  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }
  
  // ============================================
  // Public API
  // ============================================
  
  /**
   * 请求页面上下文
   */
  async requestPageContext(options?: { includeDomTree?: boolean; maxDepth?: number }): Promise<CapturedContext | null> {
    const response = await this.sendMessage<{ context: CapturedContext }>({
      type: 'REQUEST_PAGE_CONTEXT',
      payload: {
        includeDomTree: options?.includeDomTree ?? true,
        maxDepth: options?.maxDepth ?? 4
      },
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    });
    
    if (response.success && response.data?.context) {
      return response.data.context;
    }
    
    return null;
  }
  
  /**
   * 执行页面操作
   */
  async executeAction(action: PageAction): Promise<ActionResult> {
    const response = await this.sendMessage<ActionResult>({
      type: 'EXECUTE_PAGE_ACTION',
      payload: action,
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      success: false,
      actionType: action.type,
      error: response.error || 'Failed to execute action',
      duration: 0
    };
  }
  
  /**
   * 填充内容
   */
  async fillContent(
    content: string,
    options?: { selector?: string; humanLike?: boolean; delay?: number }
  ): Promise<ActionResult> {
    const response = await this.sendMessage<ActionResult>({
      type: 'FILL_CONTENT',
      payload: {
        content,
        selector: options?.selector,
        humanLike: options?.humanLike ?? true,
        delay: options?.delay
      },
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    });
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return {
      success: false,
      actionType: 'fill',
      error: response.error || 'Failed to fill content',
      duration: 0
    };
  }
  
  /**
   * 获取选中文本
   */
  async getSelection(): Promise<string | null> {
    const response = await this.sendMessage<{ text: string }>({
      type: 'GET_SELECTION',
      messageId: this.generateMessageId(),
      timestamp: Date.now()
    });
    
    if (response.success && response.data?.text) {
      return response.data.text;
    }
    
    return null;
  }
  
  /**
   * 检查 Content Script 是否可用
   */
  async isAvailable(): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return false;
    }
    
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.connectionState.connected = false;
        resolve(false);
      }, this.config.pingTimeout);
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (!tabs || tabs.length === 0 || !tabs[0].id) {
          clearTimeout(timeoutId);
          resolve(false);
          return;
        }
        
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'PING', timestamp: Date.now() },
          (response: any) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError || !response) {
              this.connectionState.connected = false;
              resolve(false);
              return;
            }
            
            this.connectionState.connected = true;
            this.connectionState.lastPing = Date.now();
            resolve(true);
          }
        );
      });
    });
  }
  
  /**
   * 获取连接状态
   */
  getConnectionState(): ContentScriptConnectionState {
    return { ...this.connectionState };
  }
  
  /**
   * 监听页面事件
   */
  onPageEvent(callback: (event: PageEvent) => void): () => void {
    const eventTypes = ['selection', 'navigation', 'mutation', 'focus', 'scroll', 'resize'];
    
    eventTypes.forEach(type => {
      if (!this.eventListeners.has(type)) {
        this.eventListeners.set(type, new Set());
      }
      this.eventListeners.get(type)!.add(callback);
    });
    
    // 返回取消订阅函数
    return () => {
      eventTypes.forEach(type => {
        this.eventListeners.get(type)?.delete(callback);
      });
    };
  }
  
  /**
   * 监听特定类型的事件
   */
  on(eventType: PageEvent['type'], callback: (event: PageEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
    
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }
  
  /**
   * 触发事件
   */
  private emitEvent(event: PageEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('[Bridge] Event listener error:', error);
        }
      });
    }
  }
  
  /**
   * 模拟模式（用于开发/测试）
   */
  enableSimulationMode(): void {
    this.connectionState.connected = true;
    this.connectionState.version = 'simulation';
    this.connectionState.currentUrl = window.location.href;
    console.log('[Bridge] Simulation mode enabled');
  }
}

// ============================================
// Singleton Instance
// ============================================

export const contentScriptBridge = new ContentScriptBridge();

export default contentScriptBridge;
