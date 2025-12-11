/**
 * Tab Controller Service
 * 
 * 多标签页控制：
 * - 打开/关闭/切换标签页
 * - 跨标签页执行操作
 * - 标签页状态管理
 */

// ============================================
// Types
// ============================================

export interface TabInfo {
    id: number;
    url: string;
    title: string;
    active: boolean;
    windowId: number;
    status?: 'loading' | 'complete';
    favIconUrl?: string;
}

export interface TabOperation {
    type: 'open' | 'close' | 'switch' | 'reload' | 'execute';
    tabId?: number;
    url?: string;
    action?: {
        type: string;
        target?: string;
        value?: string;
    };
}

export interface TabOperationResult {
    success: boolean;
    tabId?: number;
    error?: string;
    data?: any;
}

// ============================================
// Chrome API Helpers
// ============================================

declare const chrome: any;

/**
 * 检查 Chrome API 是否可用
 */
function isChromeAvailable(): boolean {
    return typeof chrome !== 'undefined' && chrome.tabs;
}

/**
 * Promise 化 Chrome API 调用
 */
function promisifyChrome<T>(fn: (callback: (result: T) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        try {
            fn((result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

// ============================================
// Tab Controller Class
// ============================================

class TabController {
    private activeTabId: number | null = null;
    private tabListeners: Set<(tabs: TabInfo[]) => void> = new Set();

    constructor() {
        this.setupListeners();
    }

    /**
     * 设置标签页变化监听
     */
    private setupListeners(): void {
        if (!isChromeAvailable()) return;

        // 监听标签页激活
        chrome.tabs?.onActivated?.addListener((activeInfo: { tabId: number }) => {
            this.activeTabId = activeInfo.tabId;
            this.notifyTabChange();
        });

        // 监听标签页更新
        chrome.tabs?.onUpdated?.addListener(() => {
            this.notifyTabChange();
        });

        // 监听标签页关闭
        chrome.tabs?.onRemoved?.addListener(() => {
            this.notifyTabChange();
        });
    }

    // ============================================
    // Tab Operations
    // ============================================

    /**
     * 获取所有标签页
     */
    async listTabs(): Promise<TabInfo[]> {
        if (!isChromeAvailable()) {
            console.warn('[TabController] Chrome API not available');
            return [];
        }

        try {
            const tabs = await promisifyChrome<any[]>((cb) =>
                chrome.tabs.query({}, cb)
            );

            return tabs.map((tab: any) => ({
                id: tab.id,
                url: tab.url || '',
                title: tab.title || '',
                active: tab.active,
                windowId: tab.windowId,
                status: tab.status,
                favIconUrl: tab.favIconUrl
            }));
        } catch (e) {
            console.error('[TabController] Failed to list tabs:', e);
            return [];
        }
    }

    /**
     * 获取当前活动标签页
     */
    async getCurrentTab(): Promise<TabInfo | null> {
        if (!isChromeAvailable()) return null;

        try {
            const tabs = await promisifyChrome<any[]>((cb) =>
                chrome.tabs.query({ active: true, currentWindow: true }, cb)
            );

            if (tabs.length > 0) {
                const tab = tabs[0];
                return {
                    id: tab.id,
                    url: tab.url || '',
                    title: tab.title || '',
                    active: true,
                    windowId: tab.windowId,
                    status: tab.status,
                    favIconUrl: tab.favIconUrl
                };
            }
        } catch (e) {
            console.error('[TabController] Failed to get current tab:', e);
        }
        return null;
    }

    /**
     * 打开新标签页
     */
    async openTab(url: string, active: boolean = true): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        try {
            const tab = await promisifyChrome<any>((cb) =>
                chrome.tabs.create({ url, active }, cb)
            );

            return { success: true, tabId: tab.id };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 关闭标签页
     */
    async closeTab(tabId: number): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        try {
            await promisifyChrome<void>((cb) =>
                chrome.tabs.remove(tabId, cb)
            );
            return { success: true, tabId };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 切换到指定标签页
     */
    async switchToTab(tabId: number): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        try {
            await promisifyChrome<any>((cb) =>
                chrome.tabs.update(tabId, { active: true }, cb)
            );
            this.activeTabId = tabId;
            return { success: true, tabId };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 刷新标签页
     */
    async reloadTab(tabId?: number): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        const targetId = tabId || this.activeTabId;
        if (!targetId) {
            return { success: false, error: 'No tab specified' };
        }

        try {
            await promisifyChrome<void>((cb) =>
                chrome.tabs.reload(targetId, {}, cb)
            );
            return { success: true, tabId: targetId };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 在指定标签页执行脚本
     */
    async executeInTab(
        tabId: number,
        action: { type: string; target?: string; value?: string }
    ): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        try {
            // 发送消息到 content script
            const result = await promisifyChrome<any>((cb) =>
                chrome.tabs.sendMessage(tabId, {
                    type: 'EXECUTE_ACTION',
                    payload: action
                }, cb)
            );

            return { success: result?.success ?? false, tabId, data: result };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 导航到指定 URL
     */
    async navigateTo(url: string, tabId?: number): Promise<TabOperationResult> {
        if (!isChromeAvailable()) {
            return { success: false, error: 'Chrome API not available' };
        }

        const targetId = tabId || this.activeTabId;
        if (!targetId) {
            // 如果没有目标标签页，打开新标签
            return this.openTab(url);
        }

        try {
            await promisifyChrome<any>((cb) =>
                chrome.tabs.update(targetId, { url }, cb)
            );
            return { success: true, tabId: targetId };
        } catch (e) {
            return { success: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    /**
     * 查找匹配 URL 的标签页
     */
    async findTabByUrl(urlPattern: string): Promise<TabInfo | null> {
        const tabs = await this.listTabs();
        return tabs.find(tab =>
            tab.url.includes(urlPattern) || new RegExp(urlPattern).test(tab.url)
        ) || null;
    }

    /**
     * 查找匹配标题的标签页
     */
    async findTabByTitle(titlePattern: string): Promise<TabInfo | null> {
        const tabs = await this.listTabs();
        const pattern = titlePattern.toLowerCase();
        return tabs.find(tab =>
            tab.title.toLowerCase().includes(pattern)
        ) || null;
    }

    // ============================================
    // Event Listeners
    // ============================================

    /**
     * 订阅标签页变化
     */
    onTabsChange(callback: (tabs: TabInfo[]) => void): () => void {
        this.tabListeners.add(callback);
        return () => this.tabListeners.delete(callback);
    }

    private async notifyTabChange(): Promise<void> {
        if (this.tabListeners.size === 0) return;
        const tabs = await this.listTabs();
        this.tabListeners.forEach(listener => listener(tabs));
    }

    /**
     * 获取当前活动标签页 ID
     */
    getActiveTabId(): number | null {
        return this.activeTabId;
    }
}

// ============================================
// Singleton Instance
// ============================================

export const tabController = new TabController();

export default tabController;
