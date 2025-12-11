/**
 * Settings Utility
 * 
 * 共用的设置读取模块，避免代码重复
 */

// ============================================
// Types
// ============================================

export interface StoredSettings {
    customApiKey?: string;
    selectedModel?: string;
    dailyQuotaLimit?: number;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'socialsage_settings';
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ============================================
// Functions
// ============================================

/**
 * 从 localStorage 获取用户设置
 */
export function getStoredSettings(): StoredSettings {
    try {
        if (typeof localStorage === 'undefined') {
            return {};
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            return {
                customApiKey: settings.customApiKey,
                selectedModel: settings.selectedModel || DEFAULT_MODEL,
                dailyQuotaLimit: settings.dailyQuotaLimit
            };
        }
    } catch (e) {
        console.warn('[Settings] Failed to read settings:', e);
    }
    return { selectedModel: DEFAULT_MODEL };
}

/**
 * 保存用户设置到 localStorage
 */
export function saveSettings(settings: Partial<StoredSettings>): void {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const current = getStoredSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn('[Settings] Failed to save settings:', e);
    }
}

/**
 * 获取 API Key (from settings or environment)
 */
export function getApiKey(): string | undefined {
    const settings = getStoredSettings();
    return settings.customApiKey || process.env.API_KEY;
}

/**
 * 获取选择的模型
 */
export function getSelectedModel(): string {
    const settings = getStoredSettings();
    return settings.selectedModel || DEFAULT_MODEL;
}
