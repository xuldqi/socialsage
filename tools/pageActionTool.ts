/**
 * Page Action Tool
 * 
 * 页面操作工具，支持：
 * - 点击元素
 * - 填充表单
 * - 滚动页面
 * - 模拟人类行为
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { PageAction, PageActionType, ActionResult } from '../types/messaging';
import { successResult, errorResult } from '../services/toolRegistry';

// ============================================
// Types
// ============================================

export interface PageActionParams {
  action: PageActionType;
  target: string;  // CSS selector or node ID
  value?: string;  // For fill action
  humanLike?: boolean;
  delay?: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 生成随机延迟（模拟人类行为）
 */
export function getHumanDelay(baseDelay: number = 100): number {
  // 添加 ±50% 的随机变化
  const variance = baseDelay * 0.5;
  return baseDelay + (Math.random() * variance * 2 - variance);
}

/**
 * 生成人类打字延迟序列
 */
export function getTypingDelays(text: string, baseDelay: number = 80): number[] {
  return text.split('').map(() => {
    // 基础延迟 50-150ms
    const delay = 50 + Math.random() * 100;
    // 偶尔有更长的停顿（模拟思考）
    if (Math.random() < 0.05) {
      return delay + 200 + Math.random() * 300;
    }
    return delay;
  });
}

/**
 * 验证选择器格式
 */
export function isValidSelector(selector: string): boolean {
  if (!selector || selector.trim().length === 0) return false;

  // 简单验证：以 #, ., [ 开头或是标签名
  const validPatterns = [
    /^#[\w-]+$/,           // ID selector
    /^\.[\w-]+$/,          // Class selector
    /^\[[\w-]+.*\]$/,      // Attribute selector
    /^[\w-]+$/,            // Tag selector
    /^[\w-]+\.[\w-]+$/,    // Tag.class
    /^[\w-]+#[\w-]+$/,     // Tag#id
  ];

  return validPatterns.some(p => p.test(selector)) || selector.includes(' ');
}

/**
 * 构建页面操作对象
 */
export function buildPageAction(params: PageActionParams): PageAction {
  return {
    type: params.action,
    selector: params.target,
    value: params.value,
    options: {
      humanLike: params.humanLike ?? true,
      delay: params.delay,
      waitForVisible: true,
      scrollIntoView: true
    }
  };
}

// ============================================
// Page Action Tool Implementation
// ============================================

async function executePageAction(
  params: Record<string, any>,
  context: AgentContext
): Promise<ToolResult> {
  let {
    action,
    target,
    value,
    humanLike = true,
    delay
  } = params;

  // 验证操作类型
  const validActions: PageActionType[] = ['click', 'fill', 'scroll', 'select', 'hover', 'focus'];
  if (!validActions.includes(action)) {
    return errorResult(
      `Invalid action type: ${action}`,
      [`Valid actions: ${validActions.join(', ')}`]
    );
  }

  // 验证目标
  if (!target && action !== 'scroll') {
    return errorResult(
      'Target selector is required for this action.',
      ['Provide a CSS selector or describe the element (e.g., "login button")']
    );
  }

  // 如果目标不是有效选择器，尝试自然语言查找
  if (target && !isValidSelector(target)) {
    // 检查是否有 DOM 树可用于智能查找
    if (context.pageContext?.domTree) {
      try {
        const { findBestMatch, findElementWithLLM } = await import('../services/elementFinder');

        // 先尝试简单匹配
        let match = findBestMatch(target, context.pageContext.domTree);

        // 如果简单匹配分数不够，尝试 LLM 增强
        if (!match || match.score < 0.5) {
          match = await findElementWithLLM(target, context.pageContext.domTree);
        }

        if (match && match.score >= 0.4) {
          console.log(`[PageAction] Found element for "${target}": ${match.selector} (score: ${match.score})`);
          target = match.selector; // 替换为找到的选择器
        } else {
          return errorResult(
            `Could not find element matching "${target}"`,
            ['Try a more specific description', 'Use a CSS selector directly']
          );
        }
      } catch (e) {
        console.warn('[PageAction] Element finder failed:', e);
        return errorResult(
          `Invalid target: "${target}" is not a valid selector and element finder failed`,
          ['Use CSS selectors like "#id", ".class", or "tag"']
        );
      }
    } else {
      return errorResult(
        `Invalid selector format: ${target}`,
        ['Use CSS selectors like "#id", ".class", or "tag"', 'Or describe the element naturally (e.g., "login button")']
      );
    }
  }

  // 对于 fill 操作，需要 value
  if (action === 'fill' && !value) {
    return errorResult(
      'Value is required for fill action.',
      ['Provide the text to fill in the field']
    );
  }

  // 检查页面上下文
  if (!context.pageContext) {
    return errorResult(
      'No page context available. Cannot execute page action.',
      ['Navigate to a webpage first', 'Make sure the content script is loaded']
    );
  }

  try {
    // 构建操作对象
    const pageAction = buildPageAction({
      action,
      target,
      value,
      humanLike,
      delay
    });

    // 尝试通过 ContentScriptBridge 执行真实操作
    let result: ActionResult;

    try {
      const { contentScriptBridge } = await import('../services/contentScriptBridge');

      // 检查 Content Script 是否可用
      const isAvailable = await contentScriptBridge.isAvailable();

      if (isAvailable) {
        // 执行真实页面操作
        result = await contentScriptBridge.executeAction(pageAction);
      } else {
        // Content Script 不可用，返回模拟结果（开发模式）
        console.warn('[PageActionTool] Content Script not available, using simulation');
        result = {
          success: true,
          actionType: action,
          duration: humanLike ? getHumanDelay(200) : 50,
          data: action === 'fill' ? { filledValue: value, simulated: true } : { simulated: true }
        };
      }
    } catch (bridgeError) {
      // Bridge 导入失败或执行失败，使用模拟模式
      console.warn('[PageActionTool] Bridge error, using simulation:', bridgeError);
      result = {
        success: true,
        actionType: action,
        duration: humanLike ? getHumanDelay(200) : 50,
        data: action === 'fill' ? { filledValue: value, simulated: true } : { simulated: true }
      };
    }

    // 生成描述
    let description = '';
    const simulated = result.data?.simulated ? ' (simulated)' : '';
    switch (action) {
      case 'click':
        description = `Clicked on element: ${target}${simulated}`;
        break;
      case 'fill':
        description = `Filled "${value}" into: ${target}${simulated}`;
        break;
      case 'scroll':
        description = `Scrolled ${target || 'page'}${simulated}`;
        break;
      case 'hover':
        description = `Hovered over: ${target}${simulated}`;
        break;
      case 'focus':
        description = `Focused on: ${target}${simulated}`;
        break;
      case 'select':
        description = `Selected: ${target}${simulated}`;
        break;
    }

    if (!result.success) {
      return errorResult(
        result.error || `Failed to ${action} on ${target}`,
        ['Check if the element exists', 'Try a different selector', 'Make sure the page is fully loaded']
      );
    }

    return successResult(
      {
        action,
        target,
        value,
        result,
        humanLike
      },
      description
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to execute page action: ${errorMessage}`,
      ['Check if the element exists', 'Try a different selector']
    );
  }
}

// ============================================
// Tool Definition
// ============================================

export const pageActionTool: Tool = {
  name: 'page_action',
  description: 'Execute actions on the current webpage like clicking buttons, filling forms, or scrolling. Supports human-like behavior simulation.',
  category: 'action',
  requiresPageContext: true,
  parameters: [
    {
      name: 'action',
      type: 'string',
      description: 'The type of action to perform: click, fill, scroll, hover, focus, select',
      required: true,
      enum: ['click', 'fill', 'scroll', 'hover', 'focus', 'select']
    },
    {
      name: 'target',
      type: 'string',
      description: 'CSS selector for the target element (e.g., "#submit-btn", ".input-field", "[data-testid=reply]")',
      required: false
    },
    {
      name: 'value',
      type: 'string',
      description: 'The value to fill (required for fill action)',
      required: false
    },
    {
      name: 'humanLike',
      type: 'boolean',
      description: 'Whether to simulate human-like behavior with random delays',
      required: false,
      default: true
    },
    {
      name: 'delay',
      type: 'number',
      description: 'Base delay in milliseconds before action',
      required: false
    }
  ],
  execute: executePageAction
};

export default pageActionTool;
