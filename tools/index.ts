/**
 * Tools Index
 * 
 * 统一导出所有内置工具，并提供注册函数
 */

import { Tool } from '../types/agent';
import { toolRegistry } from '../services/toolRegistry';

// 导入所有工具
import { summarizeTool } from './summarizeTool';
import { extractDataTool } from './extractDataTool';
import { generateReplyTool } from './generateReplyTool';
import { searchMemoryTool } from './searchMemoryTool';
import { pageActionTool } from './pageActionTool';
import { workflowTool } from './workflowTool';

// ============================================
// 内置工具列表
// ============================================

export const BUILTIN_TOOLS: Tool[] = [
  summarizeTool,
  extractDataTool,
  generateReplyTool,
  searchMemoryTool,
  pageActionTool,
  workflowTool
];

// ============================================
// 工具注册
// ============================================

/**
 * 注册所有内置工具到全局注册表
 */
export function registerBuiltinTools(): void {
  toolRegistry.registerAll(BUILTIN_TOOLS);
  console.log(`[Tools] Registered ${BUILTIN_TOOLS.length} builtin tools:`,
    BUILTIN_TOOLS.map(t => t.name).join(', '));
}

/**
 * 获取工具注册表
 */
export function getToolRegistry() {
  return toolRegistry;
}

// ============================================
// 导出单个工具
// ============================================

export { summarizeTool } from './summarizeTool';
export { extractDataTool } from './extractDataTool';
export { generateReplyTool } from './generateReplyTool';
export { searchMemoryTool } from './searchMemoryTool';
export { pageActionTool } from './pageActionTool';

// ============================================
// 导出辅助函数
// ============================================

export { chunkText, estimateTokens } from './summarizeTool';
export { extractEntities, formatAsTable, formatAsJson } from './extractDataTool';
export { searchMemories, calculateSimilarity } from './searchMemoryTool';
export { getHumanDelay, getTypingDelays, isValidSelector } from './pageActionTool';
