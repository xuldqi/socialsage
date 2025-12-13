/**
 * Content Script
 * 
 * 注入到网页中的脚本，负责：
 * - DOM 扫描和上下文提取
 * - 页面操作执行
 * - 事件监听和上报
 * - 与 Sidebar 通信
 */

import { scanPage } from './services/pageExtractor';
import { ExtensionMessage, CapturedContext } from './types';
import { PageAction, ActionResult, PageActionType } from './types/messaging';

declare const chrome: any;

// ============================================
// Constants
// ============================================

const CONTENT_SCRIPT_VERSION = '2.0.0';
const DEBOUNCE_DELAY = 1000;
const TYPING_BASE_DELAY = 80;

// ============================================
// State
// ============================================

let debounceTimer: ReturnType<typeof setTimeout>;
let lastCapturedContext: CapturedContext | null = null;
let isInitialized = false;

// Selection Popup State
let selectionPopup: HTMLElement | null = null;
let selectionPopupEnabled = true;

// Load settings
const loadSettings = async () => {
  try {
    const result = await chrome.storage.local.get('socialsage_quick_access_settings');
    const settings = result.socialsage_quick_access_settings || {};
    selectionPopupEnabled = settings.enableSelectionPopup !== false;
  } catch {
    selectionPopupEnabled = true;
  }
};

// Listen for settings changes
chrome.storage.onChanged.addListener((changes: any) => {
  if (changes.socialsage_quick_access_settings) {
    const settings = changes.socialsage_quick_access_settings.newValue || {};
    selectionPopupEnabled = settings.enableSelectionPopup !== false;
  }
});

// ============================================
// Typing Simulation
// ============================================

/**
 * 模拟打字效果 - 逐字输入，带随机延迟，看起来像真人打字
 */
const simulateTyping = async (element: HTMLElement, text: string) => {
  const isTextarea = element.tagName === 'TEXTAREA';
  const isContentEditable = element.getAttribute('contenteditable') === 'true';

  if (!isTextarea && !isContentEditable) return;

  // 先清空
  if (isTextarea) {
    (element as HTMLTextAreaElement).value = '';
  } else {
    element.innerText = '';
  }

  // 聚焦元素
  element.focus();

  // 逐字输入
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 随机延迟 (30-150ms)，模拟真实打字速度变化
    const delay = TYPING_BASE_DELAY + Math.random() * 70 - 20;

    await new Promise(resolve => setTimeout(resolve, delay));

    if (isTextarea) {
      (element as HTMLTextAreaElement).value += char;
    } else {
      element.innerText += char;
    }

    // 触发 input 事件，让网站知道内容变化了
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // 每输入几个字符触发一次 change 事件
    if (i % 5 === 0) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // 最后触发 change 事件
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

// ============================================
// DOM Extraction
// ============================================

/**
 * 扫描页面并发送上下文
 */
const captureAndSend = () => {
  try {
    const context = scanPage(document.body);

    // 添加真实 URL/Title
    context.metadata.url = window.location.href;
    context.metadata.title = document.title;

    // 添加选中文本
    const selection = window.getSelection()?.toString();
    if (selection) {
      context.userFocus = {
        ...context.userFocus,
        selectionText: selection
      };
    }

    lastCapturedContext = context;

    chrome.runtime.sendMessage({
      type: 'CAPTURED_CONTEXT',
      payload: context,
      from: 'ContentScript',
      to: 'SidePanel',
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('[ContentScript] Capture error:', e);
  }
};

/**
 * 检查 DOM 变化是否显著
 */
const isSignificantMutation = (mutations: MutationRecord[]): boolean => {
  let addedNodes = 0;
  let removedNodes = 0;

  for (const mutation of mutations) {
    addedNodes += mutation.addedNodes.length;
    removedNodes += mutation.removedNodes.length;
  }

  // 超过 5 个节点变化视为显著
  return addedNodes + removedNodes > 5;
};

// ============================================
// Page Actions
// ============================================

/**
 * 生成人类打字延迟
 */
const getTypingDelay = (): number => {
  const base = TYPING_BASE_DELAY;
  const variance = base * 0.5;
  const delay = base + (Math.random() * variance * 2 - variance);
  // 偶尔有更长的停顿
  if (Math.random() < 0.05) {
    return delay + 200 + Math.random() * 300;
  }
  return delay;
};

/**
 * 模拟人类输入
 */
const simulateHumanTyping = async (element: HTMLElement, text: string): Promise<void> => {
  const isTextarea = element.tagName === 'TEXTAREA';
  const isInput = element.tagName === 'INPUT';
  const isContentEditable = element.getAttribute('contenteditable') === 'true';

  // 聚焦元素
  element.focus();

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 触发 keydown 事件
    element.dispatchEvent(new KeyboardEvent('keydown', {
      key: char,
      bubbles: true
    }));

    // 更新值
    if (isTextarea || isInput) {
      (element as HTMLInputElement | HTMLTextAreaElement).value += char;
    } else if (isContentEditable) {
      element.innerText += char;
    }

    // 触发 input 事件
    element.dispatchEvent(new InputEvent('input', {
      data: char,
      bubbles: true
    }));

    // 触发 keyup 事件
    element.dispatchEvent(new KeyboardEvent('keyup', {
      key: char,
      bubbles: true
    }));

    // 延迟
    await new Promise(resolve => setTimeout(resolve, getTypingDelay()));
  }
};

/**
 * 执行页面操作
 */
const executePageAction = async (action: PageAction): Promise<ActionResult> => {
  const startTime = Date.now();

  try {
    let element: HTMLElement | null = null;

    // 查找目标元素
    if (action.selector) {
      element = document.querySelector(action.selector) as HTMLElement;
    } else if (action.nodeId) {
      element = document.getElementById(action.nodeId) ||
        document.querySelector(`[data-node-id="${action.nodeId}"]`) as HTMLElement;
    }

    // 滚动操作不需要元素
    if (action.type !== 'scroll' && !element) {
      return {
        success: false,
        actionType: action.type,
        error: `Element not found: ${action.selector || action.nodeId}`,
        duration: Date.now() - startTime
      };
    }

    // 等待元素可见
    if (action.options?.waitForVisible && element) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return {
          success: false,
          actionType: action.type,
          error: 'Element is not visible',
          duration: Date.now() - startTime
        };
      }
    }

    // 滚动到元素
    if (action.options?.scrollIntoView && element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 操作前延迟
    if (action.options?.delay) {
      await new Promise(resolve => setTimeout(resolve, action.options!.delay));
    }

    // 执行操作
    switch (action.type) {
      case 'click':
        if (element) {
          if (action.options?.humanLike) {
            // 模拟鼠标移动
            element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          }
          element.click();
        }
        break;

      case 'fill':
        if (element && action.value !== undefined) {
          if (action.options?.humanLike) {
            // 清空现有内容
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
              (element as HTMLInputElement).value = '';
            } else if (element.getAttribute('contenteditable') === 'true') {
              element.innerText = '';
            }
            // 模拟人类输入
            await simulateHumanTyping(element, action.value);
          } else {
            // 直接设置值
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
              (element as HTMLInputElement).value = action.value;
            } else if (element.getAttribute('contenteditable') === 'true') {
              element.innerText = action.value;
            }
            element.dispatchEvent(new InputEvent('input', { bubbles: true }));
          }
        }
        break;

      case 'scroll':
        if (action.selector === 'top') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (action.selector === 'bottom') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // 默认向下滚动
          window.scrollBy({ top: 500, behavior: 'smooth' });
        }
        break;

      case 'hover':
        if (element) {
          element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
        break;

      case 'focus':
        if (element) {
          element.focus();
        }
        break;

      case 'select':
        if (element) {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            (element as HTMLInputElement).select();
          }
        }
        break;
    }

    return {
      success: true,
      actionType: action.type,
      duration: Date.now() - startTime,
      data: action.type === 'fill' ? { filledValue: action.value } : undefined
    };

  } catch (error) {
    return {
      success: false,
      actionType: action.type,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  }
};

// ============================================
// Selection Popup
// ============================================

/**
 * 创建划词弹窗
 */
const createSelectionPopup = (): HTMLElement => {
  const popup = document.createElement('div');
  popup.className = 'socialsage-selection-popup';
  popup.innerHTML = `
    <button data-action="explain" title="解释">🔍</button>
    <button data-action="translate" title="翻译">🌐</button>
    <button data-action="summarize" title="总结">📝</button>
    <button data-action="rewrite" title="改写">✏️</button>
  `;

  // Handle button clicks - use event delegation with closest
  popup.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const button = (e.target as HTMLElement).closest('button');
    if (!button) return;

    const action = button.getAttribute('data-action');
    if (!action) return;

    const selectedText = window.getSelection()?.toString()?.trim() || '';
    if (!selectedText) {
      console.log('[SocialSage] No text selected');
      return;
    }

    console.log('[SocialSage] Sending action:', action, 'text:', selectedText.substring(0, 50));

    try {
      chrome.runtime.sendMessage({
        type: 'SELECTION_POPUP_ACTION',
        action: action,
        text: selectedText
      }, (response: any) => {
        if (chrome.runtime.lastError) {
          console.error('[SocialSage] Message error:', chrome.runtime.lastError);
        }
      });
    } catch (err) {
      console.error('[SocialSage] Send message failed:', err);
    }

    hideSelectionPopup();
  });

  return popup;
};

/**
 * 显示划词弹窗
 */
const showSelectionPopup = (x: number, y: number) => {
  if (!selectionPopupEnabled) return;

  hideSelectionPopup();

  selectionPopup = createSelectionPopup();
  selectionPopup.style.left = `${x}px`;
  selectionPopup.style.top = `${y}px`;
  document.body.appendChild(selectionPopup);
};

/**
 * 隐藏划词弹窗
 */
const hideSelectionPopup = () => {
  if (selectionPopup && selectionPopup.parentNode) {
    selectionPopup.parentNode.removeChild(selectionPopup);
    selectionPopup = null;
  }
};

// ============================================
// Event Listeners
// ============================================

/**
 * 监听鼠标抬起，显示划词弹窗
 */
document.addEventListener('mouseup', (e) => {
  // 延迟检查选中文本，让选择完成
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0 && selectionPopupEnabled) {
      // 获取选区位置
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        // 在选区上方居中显示
        const popupX = rect.left + rect.width / 2 - 80;
        const popupY = rect.top + window.scrollY - 50;
        showSelectionPopup(
          Math.max(10, popupX),
          Math.max(10, popupY)
        );
      }
    }
  }, 10);
});

/**
 * 点击其他地方隐藏弹窗
 */
document.addEventListener('mousedown', (e) => {
  if (selectionPopup && !selectionPopup.contains(e.target as Node)) {
    hideSelectionPopup();
  }
});

/**
 * 监听选中文本变化
 */
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection()?.toString();
  if (selection && selection.length > 0) {
    const range = window.getSelection()?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();

    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGE',
      payload: {
        text: selection,
        rect: rect ? {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        } : undefined
      },
      timestamp: Date.now()
    });
  } else {
    // 选择被清除时隐藏弹窗
    hideSelectionPopup();
  }
});

/**
 * 监听焦点变化
 */
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLElement;
  if (target) {
    const isEditable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.getAttribute('contenteditable') === 'true';

    chrome.runtime.sendMessage({
      type: 'FOCUS_CHANGE',
      payload: {
        element: {
          tag: target.tagName.toLowerCase(),
          id: target.id || undefined,
          classes: Array.from(target.classList),
          isEditable
        }
      },
      timestamp: Date.now()
    });
  }
});

// ============================================
// DOM Observer
// ============================================

const observer = new MutationObserver((mutations) => {
  clearTimeout(debounceTimer);

  // 检查是否是显著变化
  const significant = isSignificantMutation(mutations);

  if (significant) {
    // 通知 Sidebar 有显著 DOM 变化
    chrome.runtime.sendMessage({
      type: 'DOM_MUTATION',
      payload: {
        mutationType: 'childList',
        affectedNodes: mutations.reduce((sum, m) => sum + m.addedNodes.length + m.removedNodes.length, 0),
        isSignificant: true
      },
      timestamp: Date.now()
    });
  }

  debounceTimer = setTimeout(() => {
    captureAndSend();
  }, DEBOUNCE_DELAY);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false
});

// ============================================
// Navigation Observer
// ============================================

let lastUrl = window.location.href;

const checkNavigation = () => {
  if (window.location.href !== lastUrl) {
    const oldUrl = lastUrl;
    lastUrl = window.location.href;

    chrome.runtime.sendMessage({
      type: 'NAVIGATION',
      payload: {
        url: window.location.href,
        title: document.title,
        navigationType: 'push'
      },
      timestamp: Date.now()
    });

    // 导航后重新扫描
    setTimeout(captureAndSend, 500);
  }
};

// 监听 popstate 和 pushstate
window.addEventListener('popstate', checkNavigation);

// 拦截 pushState 和 replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
  originalPushState.apply(this, args);
  checkNavigation();
};

history.replaceState = function (...args) {
  originalReplaceState.apply(this, args);
  checkNavigation();
};

// ============================================
// Message Handler
// ============================================

chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  // PING - 检查可用性
  if (message.type === 'PING') {
    sendResponse({
      type: 'PONG',
      payload: {
        version: CONTENT_SCRIPT_VERSION,
        url: window.location.href
      },
      timestamp: Date.now()
    });
    return false;
  }

  // REQUEST_PAGE_CONTEXT - 请求页面上下文
  if (message.type === 'REQUEST_PAGE_CONTEXT') {
    captureAndSend();
    sendResponse({
      success: true,
      context: lastCapturedContext
    });
    return false;
  }

  // DOM_EXTRACT - 提取 DOM（兼容旧消息）
  if (message.type === 'DOM_EXTRACT') {
    captureAndSend();
    sendResponse({ status: 'scanned' });
    return false;
  }

  // EXECUTE_PAGE_ACTION - 执行页面操作
  if (message.type === 'EXECUTE_PAGE_ACTION') {
    executePageAction(message.payload).then(result => {
      sendResponse(result);
    });
    return true; // 异步响应
  }

  // FILL_CONTENT - 填充内容
  if (message.type === 'FILL_CONTENT') {
    const { content, selector, humanLike, delay } = message.payload;

    executePageAction({
      type: 'fill',
      selector: selector,
      value: content,
      options: { humanLike, delay }
    }).then(result => {
      sendResponse(result);
    });
    return true;
  }

  // GET_SELECTION - 获取选中文本
  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection()?.toString() || '';
    sendResponse({ text: selection });
    return false;
  }

  // UI_UPDATE - 兼容旧消息格式，带打字模拟效果
  if (message.type === 'UI_UPDATE' && message.payload?.action === 'fill_draft') {
    const activeEl = document.activeElement as HTMLElement;
    const draftText = message.payload.draft || '';

    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
      // 模拟打字效果
      simulateTyping(activeEl, draftText);
      sendResponse({ status: 'typing_started' });
    } else {
      sendResponse({ status: 'no_active_input' });
    }
    return false;
  }

  // DELETE_REPLY - 删除回复（保留原有逻辑）
  if (message.type === 'DELETE_REPLY') {
    handleDeleteReply(message.payload, sendResponse);
    return true;
  }

  return false;
});

/**
 * 处理删除回复请求
 */
const handleDeleteReply = (payload: any, sendResponse: (response: any) => void) => {
  const { replyContent, originalAuthor, elementSelector } = payload;

  const findButtonByText = (texts: string[]): HTMLElement | null => {
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
    for (const btn of allButtons) {
      const btnText = btn.textContent?.toLowerCase() || '';
      for (const searchText of texts) {
        if (btnText.includes(searchText.toLowerCase())) {
          return btn as HTMLElement;
        }
      }
    }
    return null;
  };

  // 策略 1: 使用选择器
  if (elementSelector) {
    try {
      const element = document.querySelector(elementSelector);
      if (element) {
        const deleteBtn = element.querySelector('[aria-label*="Delete" i], [aria-label*="删除" i]') as HTMLElement;
        if (deleteBtn) {
          deleteBtn.click();
          setTimeout(() => {
            const confirmBtn = findButtonByText(['delete', '删除', 'confirm', '确认']);
            if (confirmBtn) confirmBtn.click();
          }, 500);
          sendResponse({ status: 'deleted', method: 'selector' });
          return;
        }
      }
    } catch (e) {
      console.error('Selector deletion failed', e);
    }
  }

  // 策略 2: 按内容查找
  const searchText = replyContent.substring(0, Math.min(50, replyContent.length));
  const allElements = Array.from(document.querySelectorAll('article, [data-testid*="tweet"], [data-testid*="reply"]'));

  for (const container of allElements) {
    if (container.textContent?.includes(searchText)) {
      const menuBtn = container.querySelector('[aria-label*="More" i], [data-testid*="more" i]') as HTMLElement;
      if (menuBtn) {
        menuBtn.click();
        setTimeout(() => {
          const deleteOption = findButtonByText(['delete', '删除']);
          if (deleteOption) {
            deleteOption.click();
            setTimeout(() => {
              const confirmBtn = findButtonByText(['delete', '删除', 'confirm']);
              if (confirmBtn) confirmBtn.click();
            }, 500);
          }
        }, 500);
        sendResponse({ status: 'deleted', method: 'content_match' });
        return;
      }
    }
  }

  sendResponse({ status: 'not_found', message: 'Could not find reply to delete.' });
};

// ============================================
// Initialization
// ============================================

const initialize = () => {
  if (isInitialized) return;
  isInitialized = true;

  console.log(`[ContentScript] Initialized v${CONTENT_SCRIPT_VERSION}`);

  // 加载设置
  loadSettings();

  // 初始扫描
  setTimeout(captureAndSend, 1000);
};

// 页面加载完成后初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}
