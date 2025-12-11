/**
 * Smart Waiting Service
 * 
 * 智能等待：
 * - 等待页面加载完成
 * - 等待元素可见/可交互
 * - 等待网络请求完成
 * - 超时和重试策略
 */

// ============================================
// Types
// ============================================

export type WaitCondition =
    | 'load'           // DOMContentLoaded
    | 'networkIdle'    // 网络请求完成
    | 'element'        // 元素出现
    | 'visible'        // 元素可见
    | 'clickable'      // 元素可点击
    | 'hidden'         // 元素消失
    | 'url'            // URL 变化
    | 'text'           // 文本出现
    | 'custom';        // 自定义条件

export interface WaitOptions {
    /** 等待条件 */
    condition: WaitCondition;
    /** 超时时间（毫秒）*/
    timeout?: number;
    /** 轮询间隔（毫秒）*/
    interval?: number;
    /** 目标选择器（用于元素相关等待）*/
    selector?: string;
    /** 目标文本（用于 text 条件）*/
    text?: string;
    /** 目标 URL 模式（用于 url 条件）*/
    urlPattern?: string;
    /** 自定义检查函数 */
    customCheck?: () => boolean | Promise<boolean>;
}

export interface WaitResult {
    success: boolean;
    elapsed: number;
    error?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_TIMEOUT = 30000;  // 30秒
const DEFAULT_INTERVAL = 100;   // 100ms

// ============================================
// Smart Waiter Class
// ============================================

class SmartWaiter {
    private pendingRequests = 0;
    private requestListener: (() => void) | null = null;

    /**
     * 通用等待函数
     */
    async wait(options: WaitOptions): Promise<WaitResult> {
        const timeout = options.timeout || DEFAULT_TIMEOUT;
        const interval = options.interval || DEFAULT_INTERVAL;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const checkCondition = async (): Promise<boolean> => {
                try {
                    switch (options.condition) {
                        case 'load':
                            return document.readyState === 'complete';

                        case 'networkIdle':
                            return this.pendingRequests === 0;

                        case 'element':
                            return options.selector ? !!document.querySelector(options.selector) : false;

                        case 'visible':
                            if (!options.selector) return false;
                            const el = document.querySelector(options.selector);
                            return el ? this.isVisible(el as HTMLElement) : false;

                        case 'clickable':
                            if (!options.selector) return false;
                            const clickEl = document.querySelector(options.selector) as HTMLElement;
                            return clickEl ? this.isClickable(clickEl) : false;

                        case 'hidden':
                            if (!options.selector) return true;
                            const hiddenEl = document.querySelector(options.selector);
                            return !hiddenEl || !this.isVisible(hiddenEl as HTMLElement);

                        case 'url':
                            return options.urlPattern
                                ? new RegExp(options.urlPattern).test(window.location.href)
                                : false;

                        case 'text':
                            return options.text
                                ? document.body.textContent?.includes(options.text) ?? false
                                : false;

                        case 'custom':
                            return options.customCheck ? await options.customCheck() : false;

                        default:
                            return false;
                    }
                } catch (e) {
                    console.warn('[SmartWaiter] Check failed:', e);
                    return false;
                }
            };

            const poll = async () => {
                const elapsed = Date.now() - startTime;

                if (elapsed >= timeout) {
                    resolve({ success: false, elapsed, error: 'Timeout' });
                    return;
                }

                if (await checkCondition()) {
                    resolve({ success: true, elapsed });
                    return;
                }

                setTimeout(poll, interval);
            };

            poll();
        });
    }

    /**
     * 等待页面加载完成
     */
    async waitForLoad(timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'load', timeout });
    }

    /**
     * 等待网络空闲
     */
    async waitForNetworkIdle(timeout?: number): Promise<WaitResult> {
        // 监听 fetch 和 XHR
        this.startNetworkMonitoring();
        const result = await this.wait({ condition: 'networkIdle', timeout });
        this.stopNetworkMonitoring();
        return result;
    }

    /**
     * 等待元素出现
     */
    async waitForElement(selector: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'element', selector, timeout });
    }

    /**
     * 等待元素可见
     */
    async waitForVisible(selector: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'visible', selector, timeout });
    }

    /**
     * 等待元素可点击
     */
    async waitForClickable(selector: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'clickable', selector, timeout });
    }

    /**
     * 等待元素消失
     */
    async waitForHidden(selector: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'hidden', selector, timeout });
    }

    /**
     * 等待 URL 变化
     */
    async waitForUrl(pattern: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'url', urlPattern: pattern, timeout });
    }

    /**
     * 等待文本出现
     */
    async waitForText(text: string, timeout?: number): Promise<WaitResult> {
        return this.wait({ condition: 'text', text, timeout });
    }

    /**
     * 智能等待：自动检测最佳等待条件
     */
    async smartWait(selector?: string, timeout?: number): Promise<WaitResult> {
        // 1. 先等页面加载
        const loadResult = await this.waitForLoad(5000);
        if (!loadResult.success) {
            console.warn('[SmartWaiter] Page load timeout, continuing...');
        }

        // 2. 如果有选择器，等待元素可交互
        if (selector) {
            // 先等元素出现
            const elResult = await this.waitForElement(selector, timeout);
            if (!elResult.success) return elResult;

            // 再等元素可点击
            return this.waitForClickable(selector, 2000);
        }

        // 3. 短暂等待确保稳定
        await this.sleep(300);
        return { success: true, elapsed: loadResult.elapsed + 300 };
    }

    // ============================================
    // Helper Methods
    // ============================================

    private isVisible(element: HTMLElement): boolean {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    private isClickable(element: HTMLElement): boolean {
        if (!this.isVisible(element)) return false;

        const style = window.getComputedStyle(element);
        if (style.pointerEvents === 'none') return false;
        if (element.hasAttribute('disabled')) return false;

        // 检查是否被其他元素遮挡
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);

        return element.contains(topElement) || topElement === element;
    }

    private startNetworkMonitoring(): void {
        // 拦截 fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            this.pendingRequests++;
            try {
                return await originalFetch(...args);
            } finally {
                this.pendingRequests--;
            }
        };

        // 拦截 XHR
        const originalOpen = XMLHttpRequest.prototype.open;
        const self = this;
        XMLHttpRequest.prototype.open = function (...args: any[]) {
            this.addEventListener('loadstart', () => self.pendingRequests++);
            this.addEventListener('loadend', () => self.pendingRequests--);
            return originalOpen.apply(this, args as [string, string]);
        };
    }

    private stopNetworkMonitoring(): void {
        // 简化处理：重置计数器
        this.pendingRequests = 0;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// Singleton Instance
// ============================================

export const smartWaiter = new SmartWaiter();

export default smartWaiter;
