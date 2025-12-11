/**
 * Extract Data Tool
 * 
 * 数据提取工具，支持：
 * - 从页面提取结构化数据
 * - 实体识别（邮箱、电话、链接等）
 * - 自定义选择器提取
 * - 返回 JSON 格式结果
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { successResult, errorResult } from '../services/toolRegistry';

// ============================================
// Entity Patterns
// ============================================

const ENTITY_PATTERNS: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Improved phone regex: requires more specific patterns to avoid matching dates
  phone: /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g,
  url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
  price: /(?:\$|¥|€|£)[\d,]+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*(?:USD|CNY|EUR|GBP|元|美元)/g,
  date: /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/g,
  hashtag: /#[\w\u4e00-\u9fff]+/g,
  mention: /@[\w]+/g,
  percentage: /\d+(?:\.\d+)?%/g
};

// ============================================
// Types
// ============================================

export interface ExtractedEntity {
  type: string;
  value: string;
  count: number;
  positions?: number[];
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  rawData?: Record<string, any>[];
  totalFound: number;
  source: 'page' | 'selection' | 'provided';
}

// ============================================
// Helper Functions
// ============================================

/**
 * 从文本中提取实体
 */
export function extractEntities(text: string, entityTypes?: string[]): ExtractedEntity[] {
  const results: Map<string, ExtractedEntity> = new Map();
  const typesToExtract = entityTypes || Object.keys(ENTITY_PATTERNS);

  for (const type of typesToExtract) {
    const pattern = ENTITY_PATTERNS[type];
    if (!pattern) continue;

    const matches = text.match(pattern) || [];
    const uniqueMatches = [...new Set(matches)];

    for (const match of uniqueMatches) {
      const key = `${type}:${match}`;
      if (results.has(key)) {
        results.get(key)!.count++;
      } else {
        results.set(key, {
          type,
          value: match,
          count: matches.filter(m => m === match).length
        });
      }
    }
  }

  return Array.from(results.values());
}

/**
 * 从 DOM 树中提取数据
 */
export function extractFromDomTree(
  domTree: any[],
  selector?: string
): Record<string, any>[] {
  const results: Record<string, any>[] = [];

  function traverse(nodes: any[]) {
    for (const node of nodes) {
      // 如果有选择器，检查是否匹配
      if (selector) {
        const matchesSelector =
          node.tag === selector ||
          node.classes?.includes(selector.replace('.', '')) ||
          node.attributes?.id === selector.replace('#', '');

        if (matchesSelector && node.text) {
          results.push({
            tag: node.tag,
            text: node.text,
            classes: node.classes,
            attributes: node.attributes
          });
        }
      } else {
        // 提取所有有文本的节点
        if (node.text && node.text.length > 5) {
          results.push({
            tag: node.tag,
            text: node.text,
            classes: node.classes
          });
        }
      }

      // 递归处理子节点
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(domTree);
  return results;
}

/**
 * 格式化提取结果为表格
 */
export function formatAsTable(entities: ExtractedEntity[]): string {
  if (entities.length === 0) return 'No data found.';

  const header = '| Type | Value | Count |';
  const separator = '|------|-------|-------|';
  const rows = entities.map(e => `| ${e.type} | ${e.value} | ${e.count} |`);

  return [header, separator, ...rows].join('\n');
}

/**
 * 格式化提取结果为 JSON
 */
export function formatAsJson(result: ExtractionResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================
// Extract Data Tool Implementation
// ============================================

async function executeExtractData(
  params: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const {
    entityType,
    selector,
    content,
    format = 'json',
    useLLM = false  // 是否使用 LLM 增强提取
  } = params;

  // 确定数据来源
  let textToExtract = content;
  let source: 'page' | 'selection' | 'provided' = 'provided';

  if (!textToExtract) {
    if (context.selection) {
      textToExtract = context.selection;
      source = 'selection';
    } else if (context.pageContext?.mainContent) {
      textToExtract = context.pageContext.mainContent;
      source = 'page';
    } else {
      return errorResult(
        'No content to extract from. Please provide content, select text, or navigate to a page.',
        ['Select some text on the page', 'Navigate to a webpage']
      );
    }
  }

  try {
    // 提取实体（正则表达式方式）
    const entityTypes = entityType ? [entityType] : undefined;
    const entities = extractEntities(textToExtract, entityTypes);

    // 如果有 DOM 树和选择器，也从 DOM 提取
    let rawData: Record<string, any>[] | undefined;
    if (context.pageContext?.domTree && selector) {
      rawData = extractFromDomTree(context.pageContext.domTree, selector);
    }

    // 如果启用 LLM 增强，或者正则没找到结果，尝试用 LLM 提取
    let llmEntities: ExtractedEntity[] = [];
    if (useLLM || (entities.length === 0 && textToExtract.length > 50)) {
      try {
        llmEntities = await extractWithLLMEnhanced(textToExtract, entityType);
      } catch (e) {
        console.warn('[ExtractTool] LLM extraction failed:', e);
      }
    }

    // 合并结果（去重）
    const allEntities = mergeEntities(entities, llmEntities);

    const result: ExtractionResult = {
      entities: allEntities,
      rawData,
      totalFound: allEntities.length + (rawData?.length || 0),
      source
    };

    // 格式化输出
    let displayText: string;
    if (format === 'table') {
      displayText = formatAsTable(allEntities);
    } else {
      displayText = `Found ${result.totalFound} items:\n${formatAsJson(result)}`;
    }

    if (result.totalFound === 0) {
      return successResult(
        result,
        `No ${entityType || 'entities'} found in the content.`
      );
    }

    return successResult(result, displayText);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to extract data: ${errorMessage}`,
      ['Try with different content', 'Specify a different entity type']
    );
  }
}

/**
 * 使用 LLM 增强提取
 */
async function extractWithLLMEnhanced(content: string, entityType?: string): Promise<ExtractedEntity[]> {
  const { extractWithLLM } = await import('../services/toolLLMService');

  const settings = getStoredSettings();
  const results = await extractWithLLM(content, entityType, {
    apiKey: settings.customApiKey,
    model: settings.selectedModel || 'gemini-2.5-flash'
  });

  // 转换 LLM 结果为 ExtractedEntity 格式
  return results.map((item: any) => ({
    type: item.type || 'unknown',
    value: item.value || String(item),
    count: 1
  }));
}

/**
 * 合并实体结果（去重）
 */
function mergeEntities(regex: ExtractedEntity[], llm: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  const result: ExtractedEntity[] = [];

  for (const entity of [...regex, ...llm]) {
    const key = `${entity.type}:${entity.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(entity);
    }
  }

  return result;
}

/**
 * 从 localStorage 获取用户设置
 */
function getStoredSettings(): { customApiKey?: string; selectedModel?: string } {
  try {
    const stored = localStorage.getItem('socialsage_settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return {
        customApiKey: settings.customApiKey,
        selectedModel: settings.selectedModel
      };
    }
  } catch (e) {
    console.warn('[ExtractTool] Failed to read settings:', e);
  }
  return {};
}

// ============================================
// Tool Definition
// ============================================

export const extractDataTool: Tool = {
  name: 'extract_data',
  description: 'Extract structured data from page content, including emails, phones, URLs, prices, dates, hashtags, and mentions.',
  category: 'data',
  requiresPageContext: false,
  parameters: [
    {
      name: 'entityType',
      type: 'string',
      description: 'Type of entity to extract: email, phone, url, price, date, hashtag, mention, percentage',
      required: false,
      enum: ['email', 'phone', 'url', 'price', 'date', 'hashtag', 'mention', 'percentage']
    },
    {
      name: 'selector',
      type: 'string',
      description: 'CSS selector to target specific elements (e.g., ".product-price", "#contact-info")',
      required: false
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to extract from. If not provided, uses selected text or page content.',
      required: false
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format: json or table',
      required: false,
      default: 'json',
      enum: ['json', 'table']
    }
  ],
  execute: executeExtractData
};

export default extractDataTool;
