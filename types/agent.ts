/**
 * Agent Core Types
 * 
 * 定义 Agent 系统的核心类型，包括：
 * - Agent 状态和上下文
 * - 意图识别
 * - 工具定义和执行
 * - ReAct 循环执行计划
 */

import { ChatMessage, CapturedContext, MemoryItem, Persona, SocialPost } from '../types';

// ============================================
// Agent State & Context
// ============================================

/** Agent 运行状态 */
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting_user' | 'error';

/** Agent 当前状态 */
export interface AgentState {
  status: AgentStatus;
  currentPlan?: ExecutionPlan;
  currentStepIndex?: number;
  error?: string;
  lastUpdated: number;
}

/** Agent 完整上下文 */
export interface AgentContext {
  /** 对话历史 */
  chatHistory: ChatMessage[];
  /** 当前页面上下文 */
  pageContext?: CapturedContext;
  /** 用户选中的文本 */
  selection?: string;
  /** 相关记忆 */
  memories: MemoryItem[];
  /** 可用人设 */
  personas: Persona[];
  /** 当前激活的人设 ID */
  activePersonaId: string;
  /** 当前帖子上下文（如果在社交媒体页面） */
  currentPost?: SocialPost;
}

/** Agent 响应 */
export interface AgentStreamResponse {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
}

/** 进度更新 */
export interface ProgressUpdate {
  type: 'status' | 'step' | 'thought' | 'tool';
  message: string;
  stepIndex?: number;
  totalSteps?: number;
  toolName?: string;
}

// ============================================
// Intent Recognition
// ============================================

/** 意图类型 */
export type IntentType = 'query' | 'command' | 'clarification' | 'confirmation' | 'chat';

/** 用户意图 */
export interface Intent {
  /** 意图类型 */
  type: IntentType;
  /** 具体动作（如 summarize, extract, reply） */
  action?: string;
  /** 目标（如 this page, selected text） */
  target?: string;
  /** 提取的参数 */
  parameters?: Record<string, any>;
  /** 置信度 0-1 */
  confidence: number;
  /** 原始用户消息 */
  rawMessage: string;
}

/** 引用解析结果 */
export interface ResolvedReference {
  /** 解析后的实际内容 */
  resolved: string;
  /** 引用类型 */
  type: 'page' | 'selection' | 'memory' | 'previous_message' | 'unknown';
  /** 原始引用文本 */
  original: string;
}

// ============================================
// Tool System
// ============================================

/** 工具参数类型 */
export type ToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/** 工具参数定义 */
export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];  // 可选的枚举值
}

/** 工具定义 */
export interface Tool {
  /** 工具名称（唯一标识） */
  name: string;
  /** 工具描述（用于 LLM 理解） */
  description: string;
  /** 参数定义 */
  parameters: ToolParameter[];
  /** 执行函数 */
  execute: (params: Record<string, any>, context: AgentContext) => Promise<ToolResult>;
  /** 工具类别 */
  category?: 'content' | 'data' | 'action' | 'memory' | 'utility';
  /** 是否需要页面上下文 */
  requiresPageContext?: boolean;
}

/** 工具调用 */
export interface ToolCall {
  /** 工具名称 */
  tool: string;
  /** 调用参数 */
  parameters: Record<string, any>;
  /** 调用 ID（用于追踪） */
  callId: string;
}

/** 工具执行结果 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: string;
  /** 用于展示给用户的文本 */
  displayText?: string;
  /** 建议的后续操作 */
  suggestions?: string[];
}

/** 工具描述（用于 LLM 提示词） */
export interface ToolDescription {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
}

// ============================================
// Execution Engine (ReAct Loop)
// ============================================

/** 执行计划 */
export interface ExecutionPlan {
  /** 计划 ID */
  id: string;
  /** 计划步骤 */
  steps: PlannedStep[];
  /** 预估执行时间（毫秒） */
  estimatedDuration?: number;
  /** 创建时间 */
  createdAt: number;
}

/** 计划中的步骤 */
export interface PlannedStep {
  /** 步骤 ID */
  id: string;
  /** 要调用的工具 */
  tool: string;
  /** 工具参数 */
  parameters: Record<string, any>;
  /** 依赖的步骤 ID（必须先完成） */
  dependsOn?: string[];
  /** 步骤描述 */
  description?: string;
}

/** 执行步骤状态 */
export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** 执行中的步骤 */
export interface ExecutionStep {
  /** 步骤 ID */
  stepId: string;
  /** 当前状态 */
  status: ExecutionStepStatus;
  /** Agent 的思考过程 */
  thought?: string;
  /** 执行的动作描述 */
  action?: string;
  /** 观察到的结果 */
  observation?: string;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 错误信息 */
  error?: string;
}

/** 执行结果 */
export interface ExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 完成的步骤 */
  completedSteps: ExecutionStep[];
  /** 最终结果摘要 */
  summary?: string;
  /** 错误信息 */
  error?: string;
  /** 总执行时间 */
  duration: number;
}

// ============================================
// LLM Integration
// ============================================

/** LLM Agent 响应格式 */
export interface LLMAgentResponse {
  /** 思考过程 */
  thought: string;
  /** 要执行的动作（如果需要工具） */
  action?: {
    tool: string;
    parameters: Record<string, any>;
  };
  /** 直接回复（无需工具时） */
  response?: string;
  /** 需要用户提供更多信息 */
  needsMoreInfo?: string;
  /** 是否完成任务 */
  isComplete?: boolean;
}

/** Agent 系统提示词配置 */
export interface AgentSystemPromptConfig {
  /** Agent 角色描述 */
  role: string;
  /** Agent 能力列表 */
  capabilities: string[];
  /** 可用工具 */
  tools: ToolDescription[];
  /** 当前上下文 */
  context: {
    pageInfo?: string;
    selection?: string;
    relevantMemories?: string[];
  };
  /** 额外指令 */
  instructions: string;
  /** 输出语言 */
  outputLanguage?: string;
}

// ============================================
// Error Types
// ============================================

/** Agent 错误类型 */
export type AgentErrorType =
  | 'tool_not_found'
  | 'tool_execution_failed'
  | 'invalid_parameters'
  | 'context_unavailable'
  | 'llm_error'
  | 'timeout'
  | 'aborted'
  | 'unknown';

/** Agent 错误 */
export interface AgentError {
  type: AgentErrorType;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestions?: string[];
}
