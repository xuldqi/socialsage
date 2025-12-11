/**
 * Services Index
 * 
 * 统一导出所有服务模块
 */

// Agent Core Services
export { agentController, AgentController } from './agentController';
export { contextManager, ContextManager } from './contextManager';
export { intentTracker, IntentTracker } from './intentTracker';
export { executionEngine, ExecutionEngine } from './executionEngine';
export { errorHandler, ErrorHandler } from './errorHandler';

// Tool System
export { 
  toolRegistry, 
  ToolRegistry, 
  createToolCall, 
  createToolCallId,
  successResult,
  errorResult 
} from './toolRegistry';

// Communication
export { contentScriptBridge, ContentScriptBridge } from './contentScriptBridge';

// LLM Services
export {
  buildAgentSystemPrompt,
  formatToolDescriptions,
  formatContext,
  parseAgentResponse,
  formatChatHistory,
  getDefaultAgentConfig
} from './agentLLMService';

// Re-export existing services
export * from './geminiService';
export * from './pageExtractor';
export * from './mockContentScript';
