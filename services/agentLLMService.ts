/**
 * Agent LLM Service
 * 
 * 专门为 Agent 设计的 LLM 服务：
 * - 工具描述注入
 * - ReAct 格式输出
 * - 上下文构建
 */

import { 
  AgentSystemPromptConfig, 
  LLMAgentResponse, 
  ToolDescription,
  AgentContext 
} from '../types/agent';
import { toolRegistry } from './toolRegistry';

// ============================================
// System Prompt Templates
// ============================================

const AGENT_SYSTEM_PROMPT_TEMPLATE = `You are SocialSage, an intelligent AI assistant integrated into a browser extension.

## Your Role
${'{role}'}

## Your Capabilities
${'{capabilities}'}

## Available Tools
You have access to the following tools. Use them when appropriate:

${'{tools}'}

## Current Context
${'{context}'}

## Response Format
You MUST respond in the following JSON format:
{
  "thought": "Your reasoning about what to do",
  "action": {
    "tool": "tool_name",
    "parameters": { ... }
  },
  "response": "Your message to the user (if no tool needed)",
  "needsMoreInfo": "Question to ask user (if you need clarification)",
  "isComplete": true/false
}

## Important Rules
1. If the user's request can be handled with a tool, use the tool.
2. If you need more information, ask in "needsMoreInfo".
3. If no tool is needed, respond directly in "response".
4. Always explain your reasoning in "thought".
5. Be conversational and helpful.
6. ${'{instructions}'}

${'{languageInstruction}'}`;

// ============================================
// Helper Functions
// ============================================

/**
 * 格式化工具描述
 */
export function formatToolDescriptions(tools: ToolDescription[]): string {
  if (tools.length === 0) return 'No tools available.';
  
  return tools.map(tool => {
    const params = tool.parameters.length > 0
      ? tool.parameters.map(p => 
          `    - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n')
      : '    No parameters';
    
    return `### ${tool.name}
${tool.description}
Parameters:
${params}`;
  }).join('\n\n');
}

/**
 * 格式化上下文
 */
export function formatContext(context: AgentContext): string {
  const parts: string[] = [];
  
  if (context.pageContext) {
    parts.push(`### Current Page
- URL: ${context.pageContext.metadata.url}
- Title: ${context.pageContext.metadata.title}
- Content Preview: ${context.pageContext.mainContent.slice(0, 300)}...`);
  }
  
  if (context.selection) {
    parts.push(`### Selected Text
"${context.selection.slice(0, 200)}${context.selection.length > 200 ? '...' : ''}"`);
  }
  
  if (context.currentPost) {
    parts.push(`### Current Post
- Author: ${context.currentPost.author}
- Platform: ${context.currentPost.platform}
- Content: "${context.currentPost.content.slice(0, 200)}..."`);
  }
  
  if (context.memories.length > 0) {
    parts.push(`### Relevant Knowledge
${context.memories.slice(0, 3).map((m, i) => `${i + 1}. ${m.content}`).join('\n')}`);
  }
  
  if (context.personas.length > 0) {
    const activePersona = context.personas.find(p => p.id === context.activePersonaId);
    if (activePersona) {
      parts.push(`### Active Persona
- Name: ${activePersona.name}
- Tone: ${activePersona.tone}`);
    }
  }
  
  return parts.length > 0 ? parts.join('\n\n') : 'No context available.';
}

/**
 * 构建 Agent 系统提示词
 */
export function buildAgentSystemPrompt(config: AgentSystemPromptConfig): string {
  const toolsText = formatToolDescriptions(config.tools);
  
  const contextText = config.context.pageInfo || config.context.selection || config.context.relevantMemories?.length
    ? [
        config.context.pageInfo ? `Page: ${config.context.pageInfo}` : '',
        config.context.selection ? `Selection: "${config.context.selection}"` : '',
        config.context.relevantMemories?.length ? `Knowledge:\n${config.context.relevantMemories.join('\n')}` : ''
      ].filter(Boolean).join('\n\n')
    : 'No context available.';
  
  const languageInstruction = config.outputLanguage && config.outputLanguage !== 'en'
    ? `IMPORTANT: Respond in ${getLanguageName(config.outputLanguage)}.`
    : '';
  
  return AGENT_SYSTEM_PROMPT_TEMPLATE
    .replace('{role}', config.role)
    .replace('{capabilities}', config.capabilities.map(c => `- ${c}`).join('\n'))
    .replace('{tools}', toolsText)
    .replace('{context}', contextText)
    .replace('{instructions}', config.instructions)
    .replace('{languageInstruction}', languageInstruction);
}

/**
 * 获取语言名称
 */
function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    'zh': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ko': 'Korean'
  };
  return names[code] || code;
}

/**
 * 解析 LLM 响应
 */
export function parseAgentResponse(text: string): LLMAgentResponse {
  try {
    // 清理 markdown 代码块
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '');
    }
    
    const parsed = JSON.parse(cleanText);
    
    return {
      thought: parsed.thought || '',
      action: parsed.action,
      response: parsed.response,
      needsMoreInfo: parsed.needsMoreInfo,
      isComplete: parsed.isComplete ?? true
    };
  } catch (error) {
    // 如果解析失败，将整个文本作为响应
    return {
      thought: 'Unable to parse structured response',
      response: text,
      isComplete: true
    };
  }
}

/**
 * 构建对话历史字符串
 */
export function formatChatHistory(history: { role: string; content: string }[], maxTurns: number = 10): string {
  const recent = history.slice(-maxTurns * 2);
  
  return recent.map(msg => {
    const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
    return `${role}: ${msg.content}`;
  }).join('\n\n');
}

/**
 * 获取默认 Agent 配置
 */
export function getDefaultAgentConfig(): AgentSystemPromptConfig {
  return {
    role: 'A helpful AI assistant that can browse the web, extract information, and help with social media tasks.',
    capabilities: [
      'Summarize web pages and selected text',
      'Extract structured data (emails, phones, links, etc.)',
      'Generate social media replies with custom personas',
      'Search and recall information from knowledge base',
      'Execute page actions (click, fill, scroll)'
    ],
    tools: toolRegistry.getToolDescriptions(),
    context: {},
    instructions: 'Be helpful, concise, and conversational. Use tools when they can help accomplish the user\'s goal.'
  };
}

// ============================================
// Export
// ============================================

export default {
  buildAgentSystemPrompt,
  formatToolDescriptions,
  formatContext,
  parseAgentResponse,
  formatChatHistory,
  getDefaultAgentConfig
};
