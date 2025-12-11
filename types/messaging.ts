/**
 * Messaging Types
 * 
 * 定义 Sidebar ↔ Content Script 之间的消息通信类型
 * 包括页面操作、事件监听、数据传输等
 */

import { CapturedContext, DomNodeSummary } from '../types';

// ============================================
// Message Base Types
// ============================================

/** 消息来源 */
export type MessageSource = 'sidebar' | 'content_script' | 'background';

/** 基础消息结构 */
export interface BaseMessage<T extends string, P = any> {
  /** 消息类型 */
  type: T;
  /** 消息载荷 */
  payload?: P;
  /** 消息 ID（用于请求-响应匹配） */
  messageId?: string;
  /** 时间戳 */
  timestamp: number;
}

// ============================================
// Sidebar → Content Script Messages
// ============================================

/** 请求页面上下文 */
export interface RequestPageContextMessage extends BaseMessage<'REQUEST_PAGE_CONTEXT'> {
  payload: {
    /** 是否包含 DOM 树 */
    includeDomTree?: boolean;
    /** DOM 树最大深度 */
    maxDepth?: number;
  };
}

/** 执行页面操作 */
export interface ExecutePageActionMessage extends BaseMessage<'EXECUTE_PAGE_ACTION'> {
  payload: PageAction;
}

/** 填充表单/回复框 */
export interface FillContentMessage extends BaseMessage<'FILL_CONTENT'> {
  payload: {
    /** 目标选择器 */
    selector?: string;
    /** 要填充的内容 */
    content: string;
    /** 是否模拟人类输入 */
    humanLike?: boolean;
    /** 输入延迟（毫秒） */
    delay?: number;
  };
}

/** 滚动页面 */
export interface ScrollPageMessage extends BaseMessage<'SCROLL_PAGE'> {
  payload: {
    /** 滚动方向 */
    direction: 'up' | 'down' | 'top' | 'bottom';
    /** 滚动距离（像素） */
    distance?: number;
  };
}

/** 点击元素 */
export interface ClickElementMessage extends BaseMessage<'CLICK_ELEMENT'> {
  payload: {
    /** 目标选择器 */
    selector: string;
    /** 是否模拟人类点击 */
    humanLike?: boolean;
  };
}

/** 获取选中文本 */
export interface GetSelectionMessage extends BaseMessage<'GET_SELECTION'> {}

/** Ping 检查可用性 */
export interface PingMessage extends BaseMessage<'PING'> {}

/** Sidebar 发送的所有消息类型 */
export type SidebarMessage = 
  | RequestPageContextMessage
  | ExecutePageActionMessage
  | FillContentMessage
  | ScrollPageMessage
  | ClickElementMessage
  | GetSelectionMessage
  | PingMessage;

// ============================================
// Content Script → Sidebar Messages
// ============================================

/** 页面上下文响应 */
export interface PageContextResponse extends BaseMessage<'PAGE_CONTEXT_RESPONSE'> {
  payload: {
    success: boolean;
    context?: CapturedContext;
    error?: string;
  };
}

/** 操作执行结果 */
export interface ActionResultResponse extends BaseMessage<'ACTION_RESULT'> {
  payload: ActionResult;
}

/** 选中文本变化事件 */
export interface SelectionChangeEvent extends BaseMessage<'SELECTION_CHANGE'> {
  payload: {
    text: string;
    /** 选中区域的位置 */
    rect?: { top: number; left: number; width: number; height: number };
  };
}

/** 页面导航事件 */
export interface NavigationEvent extends BaseMessage<'NAVIGATION'> {
  payload: {
    url: string;
    title: string;
    /** 导航类型 */
    navigationType: 'push' | 'replace' | 'reload';
  };
}

/** DOM 变化事件 */
export interface DomMutationEvent extends BaseMessage<'DOM_MUTATION'> {
  payload: {
    /** 变化类型 */
    mutationType: 'childList' | 'attributes' | 'characterData';
    /** 受影响的节点数量 */
    affectedNodes: number;
    /** 是否是重大变化 */
    isSignificant: boolean;
  };
}

/** 焦点变化事件 */
export interface FocusChangeEvent extends BaseMessage<'FOCUS_CHANGE'> {
  payload: {
    /** 获得焦点的元素 */
    element?: {
      tag: string;
      id?: string;
      classes?: string[];
      isEditable: boolean;
    };
  };
}

/** Pong 响应 */
export interface PongResponse extends BaseMessage<'PONG'> {
  payload: {
    /** Content Script 版本 */
    version: string;
    /** 页面 URL */
    url: string;
  };
}

/** Content Script 发送的所有消息类型 */
export type ContentScriptMessage = 
  | PageContextResponse
  | ActionResultResponse
  | SelectionChangeEvent
  | NavigationEvent
  | DomMutationEvent
  | FocusChangeEvent
  | PongResponse;

// ============================================
// Page Actions
// ============================================

/** 页面操作类型 */
export type PageActionType = 'click' | 'fill' | 'scroll' | 'select' | 'hover' | 'focus';

/** 页面操作 */
export interface PageAction {
  /** 操作类型 */
  type: PageActionType;
  /** 目标元素选择器 */
  selector?: string;
  /** 目标节点 ID（来自 DOM 树） */
  nodeId?: string;
  /** 输入值（用于 fill 操作） */
  value?: string;
  /** 操作选项 */
  options?: PageActionOptions;
}

/** 页面操作选项 */
export interface PageActionOptions {
  /** 是否模拟人类行为 */
  humanLike?: boolean;
  /** 操作前延迟（毫秒） */
  delay?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否等待元素可见 */
  waitForVisible?: boolean;
  /** 滚动到元素 */
  scrollIntoView?: boolean;
}

/** 操作执行结果 */
export interface ActionResult {
  /** 是否成功 */
  success: boolean;
  /** 操作类型 */
  actionType: PageActionType;
  /** 错误信息 */
  error?: string;
  /** 额外数据（如获取的值） */
  data?: any;
  /** 执行时间（毫秒） */
  duration: number;
}

// ============================================
// Page Events
// ============================================

/** 页面事件类型 */
export type PageEventType = 'selection' | 'navigation' | 'mutation' | 'focus' | 'scroll' | 'resize';

/** 页面事件 */
export interface PageEvent {
  type: PageEventType;
  data: any;
  timestamp: number;
}

// ============================================
// Chrome Extension Messaging Helpers
// ============================================

/** Chrome 消息发送选项 */
export interface SendMessageOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}

/** 消息响应包装 */
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Connection State
// ============================================

/** Content Script 连接状态 */
export interface ContentScriptConnectionState {
  /** 是否已连接 */
  connected: boolean;
  /** 最后一次 ping 时间 */
  lastPing?: number;
  /** Content Script 版本 */
  version?: string;
  /** 当前页面 URL */
  currentUrl?: string;
  /** 连接错误 */
  error?: string;
}
