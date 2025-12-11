/**
 * Tool Registry
 * 
 * 工具注册和调用框架，管理所有可用工具
 * 支持工具注册、查找、参数验证和执行
 */

import {
  Tool,
  ToolParameter,
  ToolResult,
  ToolDescription,
  ToolCall,
  AgentContext,
  Intent,
  AgentError
} from '../types/agent';

// ============================================
// Tool Registry Class
// ============================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * 注册一个工具
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: Tool[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 列出所有工具
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 列出所有工具名称
   */
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 根据类别筛选工具
   */
  listByCategory(category: Tool['category']): Tool[] {
    return this.list().filter(t => t.category === category);
  }

  /**
   * 根据意图查找最匹配的工具
   */
  findByIntent(intent: Intent): Tool | null {
    if (!intent.action) return null;

    const actionLower = intent.action.toLowerCase();

    // 直接匹配工具名
    const directMatch = this.get(actionLower);
    if (directMatch) return directMatch;

    // 模糊匹配
    const actionKeywords: Record<string, string[]> = {
      'summarize': ['summarize', 'summary', 'tldr', '总结', '概括', '要約'],
      'extract_data': ['extract', 'scrape', 'get data', '提取', '抓取', '抽出'],
      'generate_reply': ['reply', 'respond', 'answer', '回复', '回答', '返信'],
      'search_memory': ['search', 'find', 'recall', '搜索', '查找', '検索'],
      'page_action': ['click', 'fill', 'scroll', 'type', '点击', '填写', 'クリック']
    };

    for (const [toolName, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(kw => actionLower.includes(kw))) {
        const tool = this.get(toolName);
        if (tool) return tool;
      }
    }

    return null;
  }

  /**
   * 验证工具参数
   */
  validateParameters(tool: Tool, params: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const param of tool.parameters) {
      const value = params[param.name];

      // 检查必填参数
      if (param.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      // 如果有值，检查类型
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== param.type && param.type !== 'object') {
          errors.push(`Parameter "${param.name}" should be ${param.type}, got ${actualType}`);
        }

        // 检查枚举值
        if (param.enum && !param.enum.includes(value)) {
          errors.push(`Parameter "${param.name}" must be one of: ${param.enum.join(', ')}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 执行工具调用
   */
  async execute(
    toolCall: ToolCall,
    context: AgentContext
  ): Promise<ToolResult> {
    const tool = this.get(toolCall.tool);

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolCall.tool}" not found`,
        suggestions: [`Available tools: ${this.listNames().join(', ')}`]
      };
    }

    // 检查是否需要页面上下文
    if (tool.requiresPageContext && !context.pageContext) {
      return {
        success: false,
        error: `Tool "${tool.name}" requires page context, but none is available`,
        suggestions: ['Please navigate to a webpage first']
      };
    }

    // 验证参数
    const validation = this.validateParameters(tool, toolCall.parameters);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid parameters: ${validation.errors.join('; ')}`,
        suggestions: ['Check the parameter requirements and try again']
      };
    }

    // 填充默认值
    const params = { ...toolCall.parameters };
    for (const param of tool.parameters) {
      if (params[param.name] === undefined && param.default !== undefined) {
        params[param.name] = param.default;
      }
    }

    try {
      // 添加 15 秒超时保护
      const TOOL_TIMEOUT = 15000;
      const timeoutPromise = new Promise<ToolResult>((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_TIMEOUT);
      });

      const result = await Promise.race([
        tool.execute(params, context),
        timeoutPromise
      ]);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timed out');
      return {
        success: false,
        error: isTimeout
          ? `Tool "${tool.name}" timed out. The operation took too long.`
          : `Tool execution failed: ${errorMessage}`,
        suggestions: isTimeout
          ? ['Try with simpler input', 'Check your network connection']
          : ['Try again or use a different approach']
      };
    }
  }

  /**
   * 生成工具描述（用于 LLM 提示词）
   */
  getToolDescriptions(): ToolDescription[] {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.map(p => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required
      }))
    }));
  }

  /**
   * 生成工具描述文本（用于 LLM 提示词）
   */
  getToolDescriptionsText(): string {
    const tools = this.list();
    if (tools.length === 0) return 'No tools available.';

    return tools.map(tool => {
      const paramsText = tool.parameters.length > 0
        ? tool.parameters.map(p =>
          `  - ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
        ).join('\n')
        : '  No parameters';

      return `${tool.name}: ${tool.description}\nParameters:\n${paramsText}`;
    }).join('\n\n');
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 移除工具
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    this.tools.clear();
  }
}

// ============================================
// Singleton Instance
// ============================================

/** 全局工具注册表实例 */
export const toolRegistry = new ToolRegistry();

// ============================================
// Helper Functions
// ============================================

/**
 * 创建工具调用 ID
 */
export function createToolCallId(): string {
  return `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建工具调用对象
 */
export function createToolCall(tool: string, parameters: Record<string, any>): ToolCall {
  return {
    tool,
    parameters,
    callId: createToolCallId()
  };
}

/**
 * 创建成功的工具结果
 */
export function successResult(data: any, displayText?: string): ToolResult {
  return {
    success: true,
    data,
    displayText
  };
}

/**
 * 创建失败的工具结果
 */
export function errorResult(error: string, suggestions?: string[]): ToolResult {
  return {
    success: false,
    error,
    suggestions
  };
}
