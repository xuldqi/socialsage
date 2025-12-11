/**
 * Data Exporter Service
 * 
 * 数据导出：
 * - 导出提取的数据为 CSV/JSON
 * - 保存到本地文件
 * - 复制到剪贴板
 */

// ============================================
// Types
// ============================================

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'html';

export interface ExportOptions {
    /** 导出格式 */
    format: ExportFormat;
    /** 文件名（不含扩展名） */
    filename?: string;
    /** 是否美化输出 */
    pretty?: boolean;
    /** 是否包含表头（CSV） */
    includeHeaders?: boolean;
    /** 是否复制到剪贴板 */
    copyToClipboard?: boolean;
    /** 是否下载文件 */
    download?: boolean;
}

export interface ExportResult {
    success: boolean;
    content: string;
    filename?: string;
    copied?: boolean;
    downloaded?: boolean;
    error?: string;
}

// ============================================
// CSV Helpers
// ============================================

function escapeCSVField(field: any): string {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function objectToCSV(data: any[], includeHeaders = true): string {
    if (!data || data.length === 0) return '';

    // 获取所有键
    const allKeys = new Set<string>();
    data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(key => allKeys.add(key));
        }
    });
    const headers = Array.from(allKeys);

    const lines: string[] = [];

    // 添加表头
    if (includeHeaders) {
        lines.push(headers.map(escapeCSVField).join(','));
    }

    // 添加数据行
    data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            const row = headers.map(key => escapeCSVField(item[key]));
            lines.push(row.join(','));
        } else {
            lines.push(escapeCSVField(item));
        }
    });

    return lines.join('\n');
}

// ============================================
// Markdown Helpers
// ============================================

function objectToMarkdown(data: any[]): string {
    if (!data || data.length === 0) return '';

    // 检查是否是对象数组
    const isObjectArray = data.every(item => typeof item === 'object' && item !== null);

    if (!isObjectArray) {
        // 简单列表
        return data.map(item => `- ${String(item)}`).join('\n');
    }

    // 获取所有键
    const allKeys = new Set<string>();
    data.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    // 创建 Markdown 表格
    const lines: string[] = [];
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

    data.forEach(item => {
        const row = headers.map(key => String(item[key] ?? ''));
        lines.push('| ' + row.join(' | ') + ' |');
    });

    return lines.join('\n');
}

// ============================================
// HTML Helpers
// ============================================

function objectToHTML(data: any[]): string {
    if (!data || data.length === 0) return '<p>No data</p>';

    const isObjectArray = data.every(item => typeof item === 'object' && item !== null);

    if (!isObjectArray) {
        return '<ul>' + data.map(item => `<li>${String(item)}</li>`).join('') + '</ul>';
    }

    const allKeys = new Set<string>();
    data.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    let html = '<table border="1" cellpadding="5" style="border-collapse: collapse;">';
    html += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
    html += '<tbody>';
    data.forEach(item => {
        html += '<tr>' + headers.map(key => `<td>${String(item[key] ?? '')}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';

    return html;
}

// ============================================
// Data Exporter Class
// ============================================

class DataExporter {

    /**
     * 导出数据
     */
    async export(data: any, options: ExportOptions): Promise<ExportResult> {
        try {
            // 确保数据是数组
            const dataArray = Array.isArray(data) ? data : [data];

            // 格式化数据
            let content: string;
            let extension: string;

            switch (options.format) {
                case 'json':
                    content = options.pretty
                        ? JSON.stringify(dataArray, null, 2)
                        : JSON.stringify(dataArray);
                    extension = 'json';
                    break;

                case 'csv':
                    content = objectToCSV(dataArray, options.includeHeaders ?? true);
                    extension = 'csv';
                    break;

                case 'markdown':
                    content = objectToMarkdown(dataArray);
                    extension = 'md';
                    break;

                case 'html':
                    content = objectToHTML(dataArray);
                    extension = 'html';
                    break;

                default:
                    content = JSON.stringify(dataArray, null, 2);
                    extension = 'json';
            }

            const filename = `${options.filename || 'export'}_${Date.now()}.${extension}`;
            const result: ExportResult = { success: true, content, filename };

            // 复制到剪贴板
            if (options.copyToClipboard) {
                try {
                    await navigator.clipboard.writeText(content);
                    result.copied = true;
                } catch (e) {
                    console.warn('[DataExporter] Clipboard copy failed:', e);
                    result.copied = false;
                }
            }

            // 下载文件
            if (options.download) {
                this.downloadFile(content, filename, this.getMimeType(options.format));
                result.downloaded = true;
            }

            return result;

        } catch (error) {
            return {
                success: false,
                content: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 快捷方法：导出为 JSON
     */
    async toJSON(data: any, filename?: string): Promise<ExportResult> {
        return this.export(data, { format: 'json', pretty: true, download: true, filename });
    }

    /**
     * 快捷方法：导出为 CSV
     */
    async toCSV(data: any, filename?: string): Promise<ExportResult> {
        return this.export(data, { format: 'csv', download: true, filename });
    }

    /**
     * 快捷方法：复制为 Markdown
     */
    async toMarkdown(data: any): Promise<ExportResult> {
        return this.export(data, { format: 'markdown', copyToClipboard: true });
    }

    /**
     * 快捷方法：复制到剪贴板
     */
    async copyToClipboard(data: any, format: ExportFormat = 'json'): Promise<ExportResult> {
        return this.export(data, { format, copyToClipboard: true, pretty: true });
    }

    // ============================================
    // Helper Methods
    // ============================================

    private getMimeType(format: ExportFormat): string {
        const mimeTypes: Record<ExportFormat, string> = {
            json: 'application/json',
            csv: 'text/csv',
            markdown: 'text/markdown',
            html: 'text/html'
        };
        return mimeTypes[format] || 'text/plain';
    }

    private downloadFile(content: string, filename: string, mimeType: string): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }
}

// ============================================
// Singleton Instance
// ============================================

export const dataExporter = new DataExporter();

export default dataExporter;
