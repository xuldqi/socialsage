/**
 * Generate Reply Tool
 * 
 * 回复生成工具，支持：
 * - 基于人设生成回复
 * - 支持不同意图（同意、反对、幽默等）
 * - 集成现有 generateReply 函数
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { successResult, errorResult } from '../services/toolRegistry';
import { SocialPost, Platform, MemoryItem, Persona } from '../types';

// ============================================
// Types
// ============================================

export type ReplyIntent = 'agree' | 'disagree' | 'question' | 'humor' | 'support' | 'neutral';

export interface GenerateReplyParams {
  postContent: string;
  postAuthor?: string;
  platform?: Platform;
  intent?: ReplyIntent;
  personaId?: string;
  customInstruction?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 构建回复提示词
 */
function buildReplyPrompt(
  params: GenerateReplyParams,
  persona: { name: string; tone: string; exampleText: string } | null
): string {
  const { postContent, postAuthor, platform, intent, customInstruction } = params;
  
  let prompt = `Generate a reply to this ${platform || 'social media'} post`;
  if (postAuthor) {
    prompt += ` by ${postAuthor}`;
  }
  prompt += `:\n\n"${postContent}"\n\n`;
  
  if (persona) {
    prompt += `Use this persona style:\n`;
    prompt += `- Name: ${persona.name}\n`;
    prompt += `- Tone: ${persona.tone}\n`;
    prompt += `- Example: "${persona.exampleText}"\n\n`;
  }
  
  if (intent) {
    const intentInstructions: Record<ReplyIntent, string> = {
      agree: 'Express agreement and support for the post.',
      disagree: 'Respectfully express a different viewpoint.',
      question: 'Ask a thoughtful follow-up question.',
      humor: 'Add a witty or humorous response.',
      support: 'Offer encouragement and support.',
      neutral: 'Provide a balanced, neutral response.'
    };
    prompt += `Intent: ${intentInstructions[intent]}\n\n`;
  }
  
  if (customInstruction) {
    prompt += `Additional instruction: ${customInstruction}\n\n`;
  }
  
  prompt += 'Keep the reply concise and natural. Avoid sounding robotic or overly formal.';
  
  return prompt;
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
    console.warn('[GenerateReplyTool] Failed to read settings:', e);
  }
  return {};
}

/**
 * 调用 LLM 生成回复
 */
async function callLLMForReply(
  content: string,
  author: string,
  persona: Persona | null,
  intent: ReplyIntent,
  memories: MemoryItem[] = []
): Promise<string> {
  const { generateReplyWithLLM } = await import('../services/toolLLMService');
  const settings = getStoredSettings();
  
  return generateReplyWithLLM(
    content,
    author,
    persona,
    intent,
    memories,
    {
      apiKey: settings.customApiKey,
      model: settings.selectedModel || 'gemini-2.5-flash'
    }
  );
}

// ============================================
// Generate Reply Tool Implementation
// ============================================

async function executeGenerateReply(
  params: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  const { 
    postContent, 
    postAuthor,
    platform,
    intent = 'neutral',
    personaId,
    customInstruction 
  } = params;
  
  // 确定帖子内容
  let content = postContent;
  let author = postAuthor;
  let postPlatform = platform;
  
  // 如果没有提供内容，尝试从上下文获取
  if (!content && context.currentPost) {
    content = context.currentPost.content;
    author = context.currentPost.author;
    postPlatform = context.currentPost.platform;
  }
  
  if (!content) {
    return errorResult(
      'No post content to reply to. Please provide post content or select a post.',
      ['Provide the post content directly', 'Click on a post to set context']
    );
  }
  
  // 获取人设
  let persona = null;
  const targetPersonaId = personaId || context.activePersonaId;
  
  if (targetPersonaId && context.personas) {
    persona = context.personas.find(p => p.id === targetPersonaId);
  }
  
  if (!persona && context.personas?.length > 0) {
    persona = context.personas[0];
  }
  
  try {
    // 构建提示词
    const prompt = buildReplyPrompt(
      {
        postContent: content,
        postAuthor: author,
        platform: postPlatform,
        intent: intent as ReplyIntent,
        customInstruction
      },
      persona
    );
    
    // 获取相关记忆用于上下文增强
    const relevantMemories = context.memories?.slice(0, 3) || [];
    
    // 调用 LLM 生成回复
    const reply = await callLLMForReply(
      content,
      author || 'unknown',
      persona,
      intent as ReplyIntent,
      relevantMemories
    );
    
    return successResult(
      {
        reply,
        postContent: content,
        postAuthor: author,
        platform: postPlatform,
        personaUsed: persona?.name,
        intent
      },
      reply
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to generate reply: ${errorMessage}`,
      ['Try with different settings', 'Check your API key']
    );
  }
}

// ============================================
// Tool Definition
// ============================================

export const generateReplyTool: Tool = {
  name: 'generate_reply',
  description: 'Generate a social media reply based on persona and intent. Can reply to the current post or provided content.',
  category: 'content',
  requiresPageContext: false,
  parameters: [
    {
      name: 'postContent',
      type: 'string',
      description: 'The content of the post to reply to. If not provided, uses current post context.',
      required: false
    },
    {
      name: 'postAuthor',
      type: 'string',
      description: 'The author of the post.',
      required: false
    },
    {
      name: 'platform',
      type: 'string',
      description: 'The social media platform.',
      required: false,
      enum: ['X', 'Weibo', 'Xiaohongshu', 'Facebook', 'Reddit', 'YouTube']
    },
    {
      name: 'intent',
      type: 'string',
      description: 'The intent of the reply: agree, disagree, question, humor, support, neutral',
      required: false,
      default: 'neutral',
      enum: ['agree', 'disagree', 'question', 'humor', 'support', 'neutral']
    },
    {
      name: 'personaId',
      type: 'string',
      description: 'ID of the persona to use. If not provided, uses the active persona.',
      required: false
    },
    {
      name: 'customInstruction',
      type: 'string',
      description: 'Additional instructions for generating the reply.',
      required: false
    }
  ],
  execute: executeGenerateReply
};

export default generateReplyTool;
