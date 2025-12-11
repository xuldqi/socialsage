/**
 * Cross-Tab Context Service
 * 
 * 跨标签页上下文合成：
 * - 从多个标签页收集信息
 * - 合成综合报告
 * - 比较多个页面
 */

import { tabController, TabInfo } from './tabController';
import { CapturedContext } from '../types';

// ============================================
// Types
// ============================================

export interface TabContext {
    tabId: number;
    url: string;
    title: string;
    content?: string;
    extractedData?: Record<string, any>;
    error?: string;
}

export interface SynthesisResult {
    success: boolean;
    tabContexts: TabContext[];
    synthesis?: string;
    comparison?: ComparisonResult;
    error?: string;
}

export interface ComparisonResult {
    /** 共同点 */
    similarities: string[];
    /** 差异点 */
    differences: string[];
    /** 各页面独有内容 */
    unique: Record<number, string[]>;
}

export interface SynthesisOptions {
    /** 要分析的标签页 IDs（空则分析所有） */
    tabIds?: number[];
    /** 要提取的数据类型 */
    extractTypes?: ('prices' | 'features' | 'reviews' | 'custom')[];
    /** 是否生成比较 */
    compare?: boolean;
    /** 是否生成综合报告 */
    synthesize?: boolean;
    /** 自定义提取规则 */
    customExtract?: string;
    /** 输出语言 */
    language?: string;
}

// ============================================
// Message Types for Content Script
// ============================================

interface ExtractContentMessage {
    type: 'EXTRACT_CONTENT';
    payload: {
        extractType?: string;
    };
}

// ============================================
// Cross-Tab Context Class
// ============================================

declare const chrome: any;

class CrossTabContext {

    /**
     * 收集多个标签页的上下文
     */
    async collectContexts(tabIds?: number[]): Promise<TabContext[]> {
        // 获取要处理的标签页
        const allTabs = await tabController.listTabs();
        const targetTabs = tabIds
            ? allTabs.filter(t => tabIds.includes(t.id))
            : allTabs.filter(t => t.url.startsWith('http')); // 只处理 HTTP 页面

        const contexts: TabContext[] = [];

        for (const tab of targetTabs) {
            try {
                const context = await this.getTabContext(tab);
                contexts.push(context);
            } catch (e) {
                contexts.push({
                    tabId: tab.id,
                    url: tab.url,
                    title: tab.title,
                    error: e instanceof Error ? e.message : String(e)
                });
            }
        }

        return contexts;
    }

    /**
     * 获取单个标签页的上下文
     */
    private async getTabContext(tab: TabInfo): Promise<TabContext> {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                reject(new Error('Chrome API not available'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Timeout getting tab context'));
            }, 10000);

            chrome.tabs.sendMessage(tab.id, {
                type: 'REQUEST_PAGE_CONTEXT',
                payload: { includeDomTree: false }
            }, (response: any) => {
                clearTimeout(timeout);

                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response?.success && response?.context) {
                    resolve({
                        tabId: tab.id,
                        url: tab.url,
                        title: tab.title,
                        content: response.context.mainContent || '',
                        extractedData: response.context.metadata
                    });
                } else {
                    resolve({
                        tabId: tab.id,
                        url: tab.url,
                        title: tab.title,
                        error: 'Failed to get context'
                    });
                }
            });
        });
    }

    /**
     * 合成多个标签页的信息
     */
    async synthesize(options: SynthesisOptions = {}): Promise<SynthesisResult> {
        try {
            // 收集上下文
            const tabContexts = await this.collectContexts(options.tabIds);

            if (tabContexts.length === 0) {
                return { success: false, tabContexts: [], error: 'No valid tabs found' };
            }

            const result: SynthesisResult = {
                success: true,
                tabContexts
            };

            // 生成比较
            if (options.compare && tabContexts.length > 1) {
                result.comparison = this.compareContexts(tabContexts);
            }

            // 生成综合报告
            if (options.synthesize) {
                result.synthesis = this.buildSynthesis(tabContexts, options);
            }

            return result;

        } catch (error) {
            return {
                success: false,
                tabContexts: [],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 比较多个上下文
     */
    private compareContexts(contexts: TabContext[]): ComparisonResult {
        const result: ComparisonResult = {
            similarities: [],
            differences: [],
            unique: {}
        };

        // 简单的文本比较
        const allWords = contexts.map(ctx =>
            new Set((ctx.content || '').toLowerCase().split(/\s+/).filter(w => w.length > 3))
        );

        if (allWords.length < 2) return result;

        // 找共同词
        let commonWords = allWords[0];
        for (let i = 1; i < allWords.length; i++) {
            commonWords = new Set([...commonWords].filter(w => allWords[i].has(w)));
        }
        result.similarities = Array.from(commonWords).slice(0, 20);

        // 找各自独有
        contexts.forEach((ctx, i) => {
            const unique = [...allWords[i]].filter(w => {
                return !allWords.some((other, j) => j !== i && other.has(w));
            });
            result.unique[ctx.tabId] = unique.slice(0, 10);
        });

        return result;
    }

    /**
     * 构建综合报告
     */
    private buildSynthesis(contexts: TabContext[], options: SynthesisOptions): string {
        const lang = options.language || 'en';
        const lines: string[] = [];

        if (lang === 'zh') {
            lines.push(`## 多页面综合报告`);
            lines.push(`共分析 ${contexts.length} 个页面：\n`);
        } else {
            lines.push(`## Multi-Page Synthesis Report`);
            lines.push(`Analyzed ${contexts.length} pages:\n`);
        }

        contexts.forEach((ctx, i) => {
            lines.push(`### ${i + 1}. ${ctx.title}`);
            lines.push(`- URL: ${ctx.url}`);
            if (ctx.content) {
                const summary = ctx.content.slice(0, 200).replace(/\n/g, ' ');
                lines.push(`- ${lang === 'zh' ? '摘要' : 'Summary'}: ${summary}...`);
            }
            if (ctx.error) {
                lines.push(`- ${lang === 'zh' ? '错误' : 'Error'}: ${ctx.error}`);
            }
            lines.push('');
        });

        return lines.join('\n');
    }

    /**
     * 快速比较两个页面
     */
    async compareTwoPages(tabId1: number, tabId2: number): Promise<SynthesisResult> {
        return this.synthesize({
            tabIds: [tabId1, tabId2],
            compare: true,
            synthesize: true
        });
    }

    /**
     * 从所有标签页提取特定类型数据
     */
    async extractFromAll(extractType: string): Promise<Record<number, any>> {
        const contexts = await this.collectContexts();
        const results: Record<number, any> = {};

        for (const ctx of contexts) {
            if (ctx.extractedData) {
                results[ctx.tabId] = ctx.extractedData;
            }
        }

        return results;
    }
}

// ============================================
// Singleton Instance
// ============================================

export const crossTabContext = new CrossTabContext();

export default crossTabContext;
