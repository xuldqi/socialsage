/**
 * Search Memory Tool
 * 
 * 记忆搜索工具，支持：
 * - 关键词搜索
 * - 语义相似度搜索（简化版）
 * - 按来源/标签过滤
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { successResult, errorResult } from '../services/toolRegistry';
import { MemoryItem } from '../types';

// ============================================
// Types
// ============================================

export interface SearchResult {
  memory: MemoryItem;
  score: number;
  matchType: 'exact' | 'keyword' | 'semantic';
}

// ============================================
// Helper Functions
// ============================================

/**
 * 计算两个字符串的相似度（简化版 Jaccard 相似度）
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * 检查是否包含关键词
 */
export function containsKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * 搜索记忆
 */
export function searchMemories(
  memories: MemoryItem[],
  query: string,
  options: {
    limit?: number;
    source?: string;
    tags?: string[];
    minScore?: number;
  } = {}
): SearchResult[] {
  const { limit = 5, source, tags, minScore = 0.1 } = options;
  
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  for (const memory of memories) {
    // 按来源过滤
    if (source && memory.source !== source) continue;
    
    // 按标签过滤
    if (tags && tags.length > 0) {
      const memoryTags = memory.tags || [];
      if (!tags.some(t => memoryTags.includes(t))) continue;
    }
    
    const contentLower = memory.content.toLowerCase();
    let score = 0;
    let matchType: 'exact' | 'keyword' | 'semantic' = 'semantic';
    
    // 精确匹配
    if (contentLower.includes(queryLower)) {
      score = 1.0;
      matchType = 'exact';
    }
    // 关键词匹配
    else {
      const matchedWords = queryWords.filter(w => contentLower.includes(w));
      if (matchedWords.length > 0) {
        score = matchedWords.length / queryWords.length * 0.8;
        matchType = 'keyword';
      }
      // 语义相似度
      else {
        score = calculateSimilarity(query, memory.content);
        matchType = 'semantic';
      }
    }
    
    if (score >= minScore) {
      results.push({ memory, score, matchType });
    }
  }
  
  // 按分数排序
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, limit);
}

/**
 * 格式化搜索结果
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No matching memories found.';
  }
  
  return results.map((r, i) => {
    const scorePercent = Math.round(r.score * 100);
    const source = r.memory.source === 'Manual' ? '📝' : '🔗';
    return `${i + 1}. ${source} [${scorePercent}%] ${r.memory.content.slice(0, 100)}${r.memory.content.length > 100 ? '...' : ''}`;
  }).join('\n\n');
}

// ============================================
// Search Memory Tool Implementation
// ============================================

async function executeSearchMemory(
  params: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const { query, limit = 5, source, tags } = params;
  
  if (!query || query.trim().length === 0) {
    return errorResult(
      'Please provide a search query.',
      ['Provide keywords to search for']
    );
  }
  
  const memories = context.memories || [];
  
  if (memories.length === 0) {
    return successResult(
      { results: [], totalMemories: 0 },
      'No memories in the knowledge base yet. Add some memories first!'
    );
  }
  
  try {
    const results = searchMemories(memories, query, {
      limit,
      source,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined
    });
    
    const displayText = formatSearchResults(results);
    
    return successResult(
      {
        results: results.map(r => ({
          id: r.memory.id,
          content: r.memory.content,
          source: r.memory.source,
          score: r.score,
          matchType: r.matchType
        })),
        totalMemories: memories.length,
        query
      },
      displayText
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to search memories: ${errorMessage}`,
      ['Try with different keywords']
    );
  }
}

// ============================================
// Tool Definition
// ============================================

export const searchMemoryTool: Tool = {
  name: 'search_memory',
  description: 'Search the knowledge base for relevant memories using keywords or semantic similarity.',
  category: 'memory',
  requiresPageContext: false,
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query (keywords or natural language).',
      required: true
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of results to return.',
      required: false,
      default: 5
    },
    {
      name: 'source',
      type: 'string',
      description: 'Filter by source (e.g., "Manual" or a URL).',
      required: false
    },
    {
      name: 'tags',
      type: 'array',
      description: 'Filter by tags.',
      required: false
    }
  ],
  execute: executeSearchMemory
};

export default searchMemoryTool;
