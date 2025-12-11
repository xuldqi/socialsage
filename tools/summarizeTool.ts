/**
 * Summarize Tool
 * 
 * 内容总结工具，支持：
 * - 页面内容总结
 * - 选中文本总结
 * - 长文本分块处理
 * - 视频内容总结（基于描述/字幕）
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { successResult, errorResult } from '../services/toolRegistry';

// ============================================
// Constants
// ============================================

/** 单次处理的最大字符数（约 4000 tokens） */
const MAX_CHUNK_SIZE = 12000;

/** 分块重叠字符数 */
const CHUNK_OVERLAP = 500;

/** 默认摘要最大长度 */
const DEFAULT_MAX_LENGTH = 200;

// ============================================
// Helper Functions
// ============================================

/**
 * 将长文本分割成多个块
 */
export function chunkText(text: string, maxSize: number = MAX_CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (text.length <= maxSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxSize;
    
    // 尝试在句子边界处分割
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('。', end);
      const lastDot = text.lastIndexOf('. ', end);
      const lastNewline = text.lastIndexOf('\n', end);
      
      const breakPoint = Math.max(lastPeriod, lastDot, lastNewline);
      if (breakPoint > start + maxSize / 2) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks;
}

/**
 * 估算文本的 token 数量（粗略估计）
 */
export function estimateTokens(text: string): number {
  // 英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 生成总结提示词
 */
function buildSummarizePrompt(content: string, maxLength: number, language: string): string {
  const langInstruction = language === 'zh' 
    ? '请用中文回复。' 
    : language === 'ja' 
      ? '日本語で回答してください。'
      : '';
  
  return `Please summarize the following content in about ${maxLength} characters. 
Focus on the key points and main ideas. Be concise and clear.
${langInstruction}

Content:
${content}`;
}

/**
 * 合并多个摘要
 */
function buildMergeSummariesPrompt(summaries: string[], maxLength: number, language: string): string {
  const langInstruction = language === 'zh' 
    ? '请用中文回复。' 
    : language === 'ja' 
      ? '日本語で回答してください。'
      : '';
  
  return `Please combine the following summaries into a single coherent summary of about ${maxLength} characters.
Remove redundancy and keep the most important points.
${langInstruction}

Summaries:
${summaries.map((s, i) => `[Part ${i + 1}]: ${s}`).join('\n\n')}`;
}

// ============================================
// Summarize Tool Implementation
// ============================================

/**
 * 执行总结
 */
async function executeSummarize(
  params: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const { content, maxLength = DEFAULT_MAX_LENGTH, type = 'general' } = params;
  
  // 确定要总结的内容
  let textToSummarize = content;
  
  if (!textToSummarize) {
    // 优先使用选中文本
    if (context.selection) {
      textToSummarize = context.selection;
    }
    // 其次使用页面内容
    else if (context.pageContext?.mainContent) {
      textToSummarize = context.pageContext.mainContent;
    }
    else {
      return errorResult(
        'No content to summarize. Please provide content, select text, or navigate to a page.',
        ['Select some text on the page', 'Provide content directly']
      );
    }
  }
  
  // 检查内容长度
  if (textToSummarize.length < 50) {
    return errorResult(
      'Content is too short to summarize.',
      ['Provide longer content']
    );
  }
  
  // 获取语言设置
  const language = context.pageContext?.metadata?.language || 'en';
  
  try {
    // 检查是否需要分块处理
    const chunks = chunkText(textToSummarize);
    
    if (chunks.length === 1) {
      // 单块直接总结
      const summary = await callLLMForSummary(chunks[0], maxLength, language);
      return successResult(
        { summary, originalLength: textToSummarize.length, chunks: 1 },
        summary
      );
    } else {
      // 多块分别总结后合并
      const chunkSummaries: string[] = [];
      
      for (const chunk of chunks) {
        const chunkSummary = await callLLMForSummary(chunk, Math.ceil(maxLength / 2), language);
        chunkSummaries.push(chunkSummary);
      }
      
      // 合并摘要
      const finalSummary = await mergeSummaries(chunkSummaries, maxLength, language);
      
      return successResult(
        { 
          summary: finalSummary, 
          originalLength: textToSummarize.length, 
          chunks: chunks.length,
          chunkSummaries 
        },
        finalSummary
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to summarize: ${errorMessage}`,
      ['Try with shorter content', 'Check your API key']
    );
  }
}

/**
 * 调用 LLM 生成摘要
 */
async function callLLMForSummary(content: string, maxLength: number, language: string): Promise<string> {
  const { summarizeWithLLM } = await import('../services/toolLLMService');
  
  try {
    // 从 localStorage 获取用户配置
    const settings = getStoredSettings();
    
    const result = await summarizeWithLLM(content, maxLength, {
      apiKey: settings.customApiKey,
      model: settings.selectedModel || 'gemini-2.5-flash',
      outputLanguage: language
    });
    
    return result;
  } catch (error) {
    console.error('[SummarizeTool] LLM call failed, using fallback:', error);
    // 降级到简单摘要
    const sentences = content.split(/[。.!?！？\n]+/).filter(s => s.trim().length > 10);
    const topSentences = sentences.slice(0, 3);
    return topSentences.join('. ').slice(0, maxLength * 2) + '...';
  }
}

/**
 * 合并多个摘要
 */
async function mergeSummaries(summaries: string[], maxLength: number, language: string): Promise<string> {
  const { summarizeWithLLM } = await import('../services/toolLLMService');
  
  try {
    const settings = getStoredSettings();
    const combinedText = summaries.map((s, i) => `[Part ${i + 1}]: ${s}`).join('\n\n');
    
    const result = await summarizeWithLLM(
      `Please combine these summaries into one coherent summary:\n\n${combinedText}`,
      maxLength,
      {
        apiKey: settings.customApiKey,
        model: settings.selectedModel || 'gemini-2.5-flash',
        outputLanguage: language
      }
    );
    
    return result;
  } catch (error) {
    console.error('[SummarizeTool] Merge failed, using fallback:', error);
    return summaries.join(' ').slice(0, maxLength * 2);
  }
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
    console.warn('[SummarizeTool] Failed to read settings:', e);
  }
  return {};
}

// ============================================
// Tool Definition
// ============================================

export const summarizeTool: Tool = {
  name: 'summarize',
  description: 'Summarize page content, selected text, or provided content. Supports long text with automatic chunking.',
  category: 'content',
  requiresPageContext: false,
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The content to summarize. If not provided, uses selected text or page content.',
      required: false
    },
    {
      name: 'maxLength',
      type: 'number',
      description: 'Maximum length of the summary in characters.',
      required: false,
      default: DEFAULT_MAX_LENGTH
    },
    {
      name: 'type',
      type: 'string',
      description: 'Type of content: general, article, video, social',
      required: false,
      default: 'general',
      enum: ['general', 'article', 'video', 'social']
    }
  ],
  execute: executeSummarize
};

export default summarizeTool;
