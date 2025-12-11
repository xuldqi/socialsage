/**
 * Element Finder Service
 * 
 * 自然语言元素定位：
 * - 根据用户描述找到页面元素
 * - 语义匹配（文本、aria-label、placeholder）
 * - 模糊匹配支持
 */

import { DomNodeSummary } from '../types';

// ============================================
// Types
// ============================================

export interface ElementMatch {
    /** 匹配的元素节点 */
    node: DomNodeSummary;
    /** 匹配分数 0-1 */
    score: number;
    /** 匹配原因 */
    matchReason: string;
    /** 可用的 CSS 选择器 */
    selector: string;
}

export interface FindOptions {
    /** 最小匹配分数 */
    minScore?: number;
    /** 最大返回数量 */
    maxResults?: number;
    /** 只返回可交互元素 */
    interactiveOnly?: boolean;
}

// ============================================
// Constants
// ============================================

/** 常见操作动词到元素类型的映射 */
const ACTION_ELEMENT_HINTS: Record<string, string[]> = {
    // 点击类
    click: ['button', 'a', 'input[type="submit"]', '[role="button"]'],
    press: ['button', 'a', 'input[type="submit"]'],
    tap: ['button', 'a'],

    // 输入类
    type: ['input', 'textarea', '[contenteditable="true"]'],
    fill: ['input', 'textarea'],
    enter: ['input', 'textarea'],
    input: ['input', 'textarea'],

    // 选择类
    select: ['select', 'input[type="radio"]', 'input[type="checkbox"]'],
    choose: ['select', 'input[type="radio"]'],
    check: ['input[type="checkbox"]'],

    // 导航类
    go: ['a', 'button'],
    navigate: ['a', 'button'],
    open: ['a', 'button'],
    visit: ['a'],
};

/** 常见中文动词映射 */
const CHINESE_ACTION_HINTS: Record<string, string[]> = {
    点击: ['button', 'a', '[role="button"]'],
    点: ['button', 'a'],
    按: ['button', 'input[type="submit"]'],
    输入: ['input', 'textarea'],
    填写: ['input', 'textarea'],
    选择: ['select', 'input[type="radio"]', 'input[type="checkbox"]'],
    勾选: ['input[type="checkbox"]'],
    打开: ['a', 'button'],
    进入: ['a', 'button'],
};

/** 常见按钮文本别名 */
const TEXT_ALIASES: Record<string, string[]> = {
    login: ['登录', 'sign in', 'log in', 'signin', '登入'],
    register: ['注册', 'sign up', 'signup', 'create account', '创建账户'],
    submit: ['提交', 'send', 'confirm', '确认', '发送'],
    cancel: ['取消', 'close', 'dismiss', '关闭'],
    search: ['搜索', 'find', '查找', 'search'],
    next: ['下一步', 'continue', '继续', 'next step'],
    back: ['返回', 'previous', '上一步', 'go back'],
    save: ['保存', 'save changes', '保存更改'],
    delete: ['删除', 'remove', '移除'],
    edit: ['编辑', 'modify', '修改'],
    add: ['添加', 'create', 'new', '新建', '新增'],
};

// ============================================
// Helper Functions
// ============================================

/**
 * 从描述中提取关键动词和目标
 */
function parseDescription(description: string): { action?: string; target: string } {
    const lowerDesc = description.toLowerCase().trim();

    // 检查英文动词
    for (const action of Object.keys(ACTION_ELEMENT_HINTS)) {
        if (lowerDesc.startsWith(action + ' ')) {
            return {
                action,
                target: lowerDesc.slice(action.length + 1).trim()
            };
        }
    }

    // 检查中文动词
    for (const action of Object.keys(CHINESE_ACTION_HINTS)) {
        if (description.startsWith(action)) {
            return {
                action,
                target: description.slice(action.length).trim()
            };
        }
    }

    return { target: description };
}

/**
 * 计算两个字符串的相似度
 */
function calculateTextSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase().trim();
    const s2 = text2.toLowerCase().trim();

    // 完全匹配
    if (s1 === s2) return 1.0;

    // 包含关系
    if (s1.includes(s2) || s2.includes(s1)) {
        const longer = Math.max(s1.length, s2.length);
        const shorter = Math.min(s1.length, s2.length);
        return shorter / longer * 0.9;
    }

    // Jaccard 相似度
    const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 0));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size * 0.7;
}

/**
 * 检查文本是否匹配别名
 */
function matchesAlias(text: string, target: string): boolean {
    const lowerTarget = target.toLowerCase();

    for (const [key, aliases] of Object.entries(TEXT_ALIASES)) {
        if (aliases.some(a => a.toLowerCase() === lowerTarget || lowerTarget.includes(a.toLowerCase()))) {
            // 目标是已知别名，检查文本是否匹配
            if (aliases.some(a => text.toLowerCase().includes(a.toLowerCase())) ||
                text.toLowerCase().includes(key)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * 生成元素的 CSS 选择器
 */
function generateSelector(node: DomNodeSummary): string {
    // 优先使用 ID
    if (node.nodeId && !node.nodeId.startsWith('gen_')) {
        return `#${node.nodeId}`;
    }

    // 使用 aria-label
    if (node.attributes?.['aria-label']) {
        return `[aria-label="${node.attributes['aria-label']}"]`;
    }

    // 使用 class
    if (node.classes && node.classes.length > 0) {
        const meaningfulClasses = node.classes.filter(c =>
            !c.match(/^(active|visible|show|hidden|disabled)$/i) &&
            c.length > 2
        );
        if (meaningfulClasses.length > 0) {
            return `${node.tag}.${meaningfulClasses[0]}`;
        }
    }

    // 使用 data-testid
    if (node.attributes?.['data-testid']) {
        return `[data-testid="${node.attributes['data-testid']}"]`;
    }

    // 降级到标签 + 文本内容
    if (node.text) {
        return `${node.tag}:contains("${node.text.slice(0, 30)}")`;
    }

    return node.tag;
}

/**
 * 计算节点与目标描述的匹配分数
 */
function scoreNode(node: DomNodeSummary, target: string, preferredTags?: string[]): { score: number; reason: string } {
    let score = 0;
    let reason = '';

    const targetLower = target.toLowerCase();

    // 1. 文本内容匹配
    if (node.text) {
        const textSim = calculateTextSimilarity(node.text, target);
        if (textSim > score) {
            score = textSim;
            reason = `Text matches: "${node.text.slice(0, 50)}"`;
        }

        // 检查别名匹配
        if (matchesAlias(node.text, target)) {
            score = Math.max(score, 0.8);
            reason = `Alias match: "${node.text.slice(0, 50)}"`;
        }
    }

    // 2. aria-label 匹配
    if (node.attributes?.['aria-label']) {
        const labelSim = calculateTextSimilarity(node.attributes['aria-label'], target);
        if (labelSim > score) {
            score = labelSim * 0.95; // 稍低于直接文本
            reason = `aria-label matches: "${node.attributes['aria-label']}"`;
        }
    }

    // 3. placeholder 匹配
    if (node.attributes?.placeholder) {
        const placeholderSim = calculateTextSimilarity(node.attributes.placeholder, target);
        if (placeholderSim > score) {
            score = placeholderSim * 0.9;
            reason = `placeholder matches: "${node.attributes.placeholder}"`;
        }
    }

    // 4. class 名称匹配
    if (node.classes) {
        for (const cls of node.classes) {
            if (cls.toLowerCase().includes(targetLower) || targetLower.includes(cls.toLowerCase())) {
                const clsScore = 0.6;
                if (clsScore > score) {
                    score = clsScore;
                    reason = `class name matches: "${cls}"`;
                }
            }
        }
    }

    // 5. 标签类型加分（如果有偏好标签）
    if (preferredTags && preferredTags.length > 0) {
        const tagLower = node.tag.toLowerCase();
        if (preferredTags.some(pt => pt.startsWith(tagLower) || tagLower === pt.split('[')[0])) {
            score *= 1.2; // 20% 加分
            score = Math.min(score, 1.0);
        }
    }

    // 6. 可交互元素加分
    if (node.isInteractive && score > 0) {
        score *= 1.1;
        score = Math.min(score, 1.0);
    }

    return { score, reason };
}

// ============================================
// Main Functions
// ============================================

/**
 * 根据自然语言描述查找页面元素
 */
export function findElementByDescription(
    description: string,
    domTree: DomNodeSummary[],
    options: FindOptions = {}
): ElementMatch[] {
    const {
        minScore = 0.3,
        maxResults = 5,
        interactiveOnly = false
    } = options;

    // 解析描述
    const { action, target } = parseDescription(description);

    // 获取偏好的元素类型
    let preferredTags: string[] = [];
    if (action) {
        preferredTags = ACTION_ELEMENT_HINTS[action] || CHINESE_ACTION_HINTS[action] || [];
    }

    const matches: ElementMatch[] = [];

    // 递归遍历 DOM 树
    function traverse(nodes: DomNodeSummary[]) {
        for (const node of nodes) {
            // 如果只要可交互元素
            if (interactiveOnly && !node.isInteractive) {
                // 继续检查子节点
                if (node.children) traverse(node.children);
                continue;
            }

            // 计算匹配分数
            const { score, reason } = scoreNode(node, target, preferredTags);

            if (score >= minScore) {
                matches.push({
                    node,
                    score,
                    matchReason: reason,
                    selector: generateSelector(node)
                });
            }

            // 递归子节点
            if (node.children) {
                traverse(node.children);
            }
        }
    }

    traverse(domTree);

    // 按分数排序
    matches.sort((a, b) => b.score - a.score);

    return matches.slice(0, maxResults);
}

/**
 * 查找最佳匹配元素
 */
export function findBestMatch(
    description: string,
    domTree: DomNodeSummary[]
): ElementMatch | null {
    const matches = findElementByDescription(description, domTree, {
        maxResults: 1,
        minScore: 0.4,
        interactiveOnly: true
    });

    return matches.length > 0 ? matches[0] : null;
}

/**
 * 使用 LLM 增强元素查找（当简单匹配失败时）
 */
export async function findElementWithLLM(
    description: string,
    domTree: DomNodeSummary[],
    apiKey?: string
): Promise<ElementMatch | null> {
    // 先尝试简单匹配
    const simpleMatch = findBestMatch(description, domTree);
    if (simpleMatch && simpleMatch.score > 0.7) {
        return simpleMatch;
    }

    // 如果分数不够高，尝试用 LLM
    try {
        const { GoogleGenAI } = await import('@google/genai');
        const key = apiKey || process.env.API_KEY;

        if (!key) {
            return simpleMatch; // 没有 API key，返回简单匹配结果
        }

        const ai = new GoogleGenAI({ apiKey: key });

        // 构建简化的 DOM 描述
        const domDescription = domTree.slice(0, 30).map(node => ({
            tag: node.tag,
            text: node.text?.slice(0, 100),
            isInteractive: node.isInteractive,
            ariaLabel: node.attributes?.['aria-label']
        }));

        const prompt = `Find the best matching element for user intent: "${description}"

Available elements:
${JSON.stringify(domDescription, null, 2)}

Return JSON: { "index": <number>, "confidence": <0-1>, "reason": "<explanation>" }
If no good match, return { "index": -1, "confidence": 0, "reason": "No match found" }`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        });

        const result = JSON.parse(response.text || '{}');

        if (result.index >= 0 && result.index < domTree.length && result.confidence > 0.5) {
            const matchedNode = domTree[result.index];
            return {
                node: matchedNode,
                score: result.confidence,
                matchReason: result.reason,
                selector: generateSelector(matchedNode)
            };
        }
    } catch (error) {
        console.error('[ElementFinder] LLM fallback failed:', error);
    }

    return simpleMatch;
}

export default {
    findElementByDescription,
    findBestMatch,
    findElementWithLLM
};
