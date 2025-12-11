/**
 * Vision Service
 * 
 * AI 视觉识别服务：
 * - 截取页面截图
 * - 使用 Gemini Vision API 分析页面
 * - 识别元素位置和 UI 组件
 */

import { GoogleGenAI } from '@google/genai';

// ============================================
// Types
// ============================================

export interface ScreenshotOptions {
    /** 截图区域 */
    area?: 'viewport' | 'fullPage' | 'element';
    /** 目标元素选择器（当 area 为 element 时） */
    selector?: string;
    /** 图片质量 0-100 */
    quality?: number;
    /** 图片格式 */
    format?: 'png' | 'jpeg' | 'webp';
}

export interface VisionAnalysisResult {
    /** 是否成功 */
    success: boolean;
    /** 分析文本 */
    analysis?: string;
    /** 识别到的元素 */
    elements?: IdentifiedElement[];
    /** 错误信息 */
    error?: string;
}

export interface IdentifiedElement {
    /** 元素描述 */
    description: string;
    /** 元素类型 */
    type: 'button' | 'input' | 'link' | 'image' | 'text' | 'container' | 'other';
    /** 大致位置 */
    location: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    /** 边界框（如果可识别） */
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** 可能的选择器提示 */
    selectorHint?: string;
    /** 可见文本 */
    text?: string;
}

export interface VisionPromptOptions {
    /** 任务类型 */
    task: 'find_element' | 'describe_page' | 'extract_data' | 'analyze_ui';
    /** 用户查询 */
    query?: string;
    /** 输出语言 */
    language?: string;
}

// ============================================
// Constants
// ============================================

declare const chrome: any;

const VISION_MODEL = 'gemini-2.0-flash';

// ============================================
// Helper Functions
// ============================================

/**
 * 检查是否在 Chrome 扩展环境
 */
function isExtensionEnvironment(): boolean {
    return typeof chrome !== 'undefined' && chrome.tabs;
}

/**
 * 截取当前标签页截图
 */
async function captureTabScreenshot(): Promise<string | null> {
    if (!isExtensionEnvironment()) {
        console.warn('[VisionService] Not in extension environment');
        return null;
    }

    try {
        return new Promise((resolve, reject) => {
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl: string) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(dataUrl);
                }
            });
        });
    } catch (e) {
        console.error('[VisionService] Screenshot failed:', e);
        return null;
    }
}

/**
 * 将 Data URL 转换为 base64
 */
function dataUrlToBase64(dataUrl: string): string {
    const base64Index = dataUrl.indexOf('base64,');
    if (base64Index === -1) return dataUrl;
    return dataUrl.substring(base64Index + 7);
}

// ============================================
// Vision Service Class
// ============================================

class VisionService {
    private apiKey: string | null = null;

    /**
     * 设置 API Key
     */
    setApiKey(key: string): void {
        this.apiKey = key;
    }

    /**
     * 获取 API 客户端
     */
    private getClient(): GoogleGenAI | null {
        const key = this.apiKey || process.env.API_KEY;
        if (!key) {
            console.warn('[VisionService] No API key available');
            return null;
        }
        return new GoogleGenAI({ apiKey: key });
    }

    /**
     * 截取页面截图
     */
    async captureScreenshot(options: ScreenshotOptions = {}): Promise<string | null> {
        return captureTabScreenshot();
    }

    /**
     * 使用 Vision API 分析截图
     */
    async analyzeScreenshot(
        screenshot: string,
        options: VisionPromptOptions
    ): Promise<VisionAnalysisResult> {
        const client = this.getClient();
        if (!client) {
            return { success: false, error: 'No API key available' };
        }

        const base64Image = screenshot.startsWith('data:')
            ? dataUrlToBase64(screenshot)
            : screenshot;

        const prompt = this.buildPrompt(options);

        try {
            const response = await client.models.generateContent({
                model: VISION_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ],
                config: {
                    temperature: 0.3,
                    responseMimeType: options.task === 'find_element' ? 'application/json' : undefined
                }
            });

            const text = response.text || '';

            // 解析元素（如果是查找元素任务）
            if (options.task === 'find_element') {
                try {
                    const elements = JSON.parse(text);
                    return { success: true, elements, analysis: text };
                } catch {
                    return { success: true, analysis: text };
                }
            }

            return { success: true, analysis: text };

        } catch (error) {
            console.error('[VisionService] Analysis failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 查找页面中的元素
     */
    async findElement(
        description: string,
        screenshot?: string
    ): Promise<IdentifiedElement | null> {
        // 如果没有提供截图，先截取
        const image = screenshot || await this.captureScreenshot();
        if (!image) {
            console.warn('[VisionService] No screenshot available');
            return null;
        }

        const result = await this.analyzeScreenshot(image, {
            task: 'find_element',
            query: description
        });

        if (result.success && result.elements && result.elements.length > 0) {
            return result.elements[0];
        }

        return null;
    }

    /**
     * 描述页面内容
     */
    async describePage(screenshot?: string): Promise<string> {
        const image = screenshot || await this.captureScreenshot();
        if (!image) {
            return 'Unable to capture screenshot';
        }

        const result = await this.analyzeScreenshot(image, {
            task: 'describe_page'
        });

        return result.analysis || result.error || 'Analysis failed';
    }

    /**
     * 分析 UI 结构
     */
    async analyzeUI(screenshot?: string): Promise<VisionAnalysisResult> {
        const image = screenshot || await this.captureScreenshot();
        if (!image) {
            return { success: false, error: 'Unable to capture screenshot' };
        }

        return this.analyzeScreenshot(image, {
            task: 'analyze_ui'
        });
    }

    /**
     * 构建提示词
     */
    private buildPrompt(options: VisionPromptOptions): string {
        const langInstruction = options.language === 'zh'
            ? '请用中文回复。'
            : options.language === 'ja'
                ? '日本語で回答してください。'
                : '';

        switch (options.task) {
            case 'find_element':
                return `You are analyzing a webpage screenshot. Find the element matching this description: "${options.query}"

Return JSON array with elements found:
[{
  "description": "element description",
  "type": "button|input|link|image|text|container|other",
  "location": "top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right",
  "text": "visible text on element",
  "selectorHint": "suggested CSS selector like button.submit or #login-btn"
}]

If not found, return empty array [].
${langInstruction}`;

            case 'describe_page':
                return `Describe this webpage screenshot. Include:
1. What type of page is this (login, dashboard, article, etc.)
2. Main content and purpose
3. Key interactive elements
4. Overall layout structure

Be concise. ${langInstruction}`;

            case 'analyze_ui':
                return `Analyze the UI structure of this webpage. Identify:
1. Navigation elements
2. Main content areas
3. Interactive elements (buttons, forms, links)
4. Footer/sidebar if present

Return structured analysis. ${langInstruction}`;

            case 'extract_data':
                return `Extract structured data from this webpage screenshot.
Query: ${options.query || 'Extract all visible text and data'}

Return the extracted information in a clear format.
${langInstruction}`;

            default:
                return `Analyze this image. ${options.query || ''} ${langInstruction}`;
        }
    }
}

// ============================================
// Singleton Instance
// ============================================

export const visionService = new VisionService();

export default visionService;
