/**
 * Tool LLM Service
 * 
 * 为工具提供 LLM 调用能力：
 * - 内容总结
 * - 回复生成
 * - 数据提取增强
 */

import { GoogleGenAI } from "@google/genai";
import { Persona, MemoryItem } from '../types';

// ============================================
// Types
// ============================================

export interface ToolLLMConfig {
  apiKey?: string;
  model?: string;
  outputLanguage?: string;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEY = 'socialsage_daily_quota';
const DAILY_LIMIT = 10; // 每日限制 10 次

// 服务端配额 API
const QUOTA_API_URL = 'http://ssageai-backend-lsr4y2-ce0400-107-174-250-34.traefik.me';

// ============================================
// Quota Management
// ============================================

const checkAndIncrementQuota = (): boolean => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toDateString();
    let count = 0;

    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.date === today) {
        count = parsed.count;
        if (count >= DAILY_LIMIT) return false;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: count + 1 }));
    return true;
  } catch (e) {
    return true;
  }
};

// ============================================
// LLM Client
// ============================================

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

/** 检查网络连接 */
const checkNetworkConnection = (): boolean => {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // 如果无法检测，假设在线
};

/** 创建超时 Promise */
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
};

/** LLM 调用默认超时 (30秒) */
const LLM_TIMEOUT = 30000;

const getClient = (apiKey?: string): GoogleGenAI | null => {
  // 先检查网络
  if (!checkNetworkConnection()) {
    console.warn('[ToolLLM] No network connection');
    return null;
  }

  const key = apiKey || process.env.API_KEY;

  if (!key) {
    console.warn('[ToolLLM] No API key available');
    return null;
  }

  if (cachedClient && cachedApiKey === key) {
    return cachedClient;
  }

  cachedClient = new GoogleGenAI({ apiKey: key });
  cachedApiKey = key;
  return cachedClient;
};

// ============================================
// Summarization
// ============================================

/**
 * 使用 LLM 生成摘要
 */
export async function summarizeWithLLM(
  content: string,
  maxLength: number = 200,
  config?: ToolLLMConfig
): Promise<string> {
  // 检查配额
  if (!config?.apiKey && !checkAndIncrementQuota()) {
    throw new Error('Daily quota exceeded');
  }

  const client = getClient(config?.apiKey);
  if (!client) {
    // 降级到简单摘要
    return simpleSummarize(content, maxLength);
  }

  const langInstruction = config?.outputLanguage === 'zh'
    ? '请用中文回复。'
    : config?.outputLanguage === 'ja'
      ? '日本語で回答してください。'
      : '';

  const prompt = `Please summarize the following content in about ${maxLength} characters. 
Focus on the key points and main ideas. Be concise and clear.
${langInstruction}

Content:
${content.slice(0, 10000)}`;

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: config?.model || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: Math.ceil(maxLength * 2)
        }
      }),
      LLM_TIMEOUT,
      'Summarization timed out'
    );

    return response.text || simpleSummarize(content, maxLength);
  } catch (error: any) {
    console.error('[ToolLLM] Summarize error:', error);
    // 检查是否是网络/超时错误
    if (error?.message?.includes('timed out') || !checkNetworkConnection()) {
      console.warn('[ToolLLM] Network or timeout issue, using fallback');
    }
    return simpleSummarize(content, maxLength);
  }
}

/**
 * 简单摘要（降级方案）
 */
function simpleSummarize(content: string, maxLength: number): string {
  const sentences = content.split(/[。.!?！？\n]+/).filter(s => s.trim().length > 10);
  let summary = '';

  for (const sentence of sentences) {
    if (summary.length + sentence.length > maxLength * 2) break;
    summary += sentence.trim() + '. ';
  }

  return summary.trim() || content.slice(0, maxLength) + '...';
}

// ============================================
// Reply Generation
// ============================================

/**
 * 使用 LLM 生成回复
 */
export async function generateReplyWithLLM(
  postContent: string,
  postAuthor: string,
  persona: Persona | null,
  intent: string = 'neutral',
  memories: MemoryItem[] = [],
  config?: ToolLLMConfig
): Promise<string> {
  // 检查配额
  if (!config?.apiKey && !checkAndIncrementQuota()) {
    throw new Error('Daily quota exceeded');
  }

  const client = getClient(config?.apiKey);
  if (!client) {
    return `[Reply to ${postAuthor}] Thank you for sharing this!`;
  }

  const memoryContext = memories.length > 0
    ? `\n\nRelevant knowledge:\n${memories.slice(0, 3).map(m => `- ${m.content}`).join('\n')}`
    : '';

  const personaContext = persona
    ? `\n\nUse this persona style:
- Name: ${persona.name}
- Tone: ${persona.tone}
- Example: "${persona.exampleText}"`
    : '';

  const intentMap: Record<string, string> = {
    agree: 'Express agreement and support.',
    disagree: 'Respectfully express a different viewpoint.',
    question: 'Ask a thoughtful follow-up question.',
    humor: 'Add a witty or humorous response.',
    support: 'Offer encouragement and support.',
    neutral: 'Provide a balanced, thoughtful response.'
  };

  const langInstruction = config?.outputLanguage === 'zh'
    ? '请用中文回复。'
    : config?.outputLanguage === 'ja'
      ? '日本語で回答してください。'
      : '';

  const prompt = `Generate a social media reply to this post by ${postAuthor}:
"${postContent}"

Intent: ${intentMap[intent] || intentMap.neutral}
${personaContext}
${memoryContext}

Keep the reply concise, natural, and engaging. Avoid sounding robotic.
${langInstruction}`;

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: config?.model || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.8,
          maxOutputTokens: 200
        }
      }),
      LLM_TIMEOUT,
      'Reply generation timed out'
    );

    return response.text || `Thanks for sharing, ${postAuthor}!`;
  } catch (error: any) {
    console.error('[ToolLLM] Reply generation error:', error);
    // 提供更友好的回退消息
    const fallbackReplies: Record<string, string> = {
      agree: `I agree with ${postAuthor}'s perspective!`,
      support: `Thanks for sharing this, ${postAuthor}!`,
      neutral: `Interesting point, ${postAuthor}.`,
    };
    return fallbackReplies[intent] || `Thanks for sharing, ${postAuthor}!`;
  }
}

// ============================================
// Data Extraction Enhancement
// ============================================

/**
 * 使用 LLM 增强数据提取
 */
export async function extractWithLLM(
  content: string,
  entityType?: string,
  config?: ToolLLMConfig
): Promise<any[]> {
  // 检查配额
  if (!config?.apiKey && !checkAndIncrementQuota()) {
    throw new Error('Daily quota exceeded');
  }

  const client = getClient(config?.apiKey);
  if (!client) {
    return [];
  }

  const typeInstruction = entityType
    ? `Focus on extracting ${entityType} entities.`
    : 'Extract all relevant entities (emails, phones, URLs, names, dates, prices).';

  const prompt = `Extract structured data from the following content.
${typeInstruction}

Return a JSON array of objects with "type" and "value" fields.
Example: [{"type": "email", "value": "test@example.com"}]

Content:
${content.slice(0, 5000)}`;

  try {
    const response = await client.models.generateContent({
      model: config?.model || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || '[]';
    // 清理 markdown 代码块
    const cleanText = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('[ToolLLM] Extraction error:', error);
    return [];
  }
}

export default {
  summarizeWithLLM,
  generateReplyWithLLM,
  extractWithLLM
};
