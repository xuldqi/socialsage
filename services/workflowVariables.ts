/**
 * Workflow Variables Service
 * 
 * 工作流变量和条件逻辑：
 * - 支持动态变量
 * - 条件分支
 * - 循环执行
 * - 变量插值
 */

// ============================================
// Types
// ============================================

export type VariableValue = string | number | boolean | any[] | Record<string, any>;

export interface WorkflowVariable {
    name: string;
    value: VariableValue;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    source?: 'user' | 'extracted' | 'computed';
}

export interface ConditionalBlock {
    condition: string;  // e.g., "{{price}} < 100"
    thenSteps: number[];  // 步骤索引
    elseSteps?: number[];
}

export interface LoopBlock {
    variable: string;  // 循环变量名
    items: string;  // 数据源，可以是变量名或表达式
    steps: number[];  // 循环体步骤
}

export interface WorkflowContext {
    variables: Map<string, VariableValue>;
    loopStack: { variable: string; index: number; items: any[] }[];
}

// ============================================
// Variable Parser
// ============================================

/**
 * 解析变量表达式 {{variableName}} 或 {{object.property}}
 */
function parseVariableExpression(expr: string, context: WorkflowContext): VariableValue {
    const match = expr.match(/^\{\{(.+?)\}\}$/);
    if (!match) return expr;

    const path = match[1].trim();
    return getNestedValue(path, context);
}

/**
 * 获取嵌套属性值
 */
function getNestedValue(path: string, context: WorkflowContext): VariableValue {
    const parts = path.split('.');
    let current: any = context.variables.get(parts[0]);

    // 检查是否是循环变量
    for (const loop of context.loopStack) {
        if (loop.variable === parts[0]) {
            current = loop.items[loop.index];
            break;
        }
        // 支持 {{loop.index}} 获取当前索引
        if (parts[0] === 'loop' && parts[1] === 'index') {
            return loop.index;
        }
    }

    if (current === undefined) return '';

    // 获取嵌套属性
    for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) return '';
        current = current[parts[i]];
    }

    return current ?? '';
}

/**
 * 插值字符串中的所有变量
 */
export function interpolateString(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
        const value = parseVariableExpression(`{{${expr}}}`, context);
        return String(value);
    });
}

// ============================================
// Condition Evaluator
// ============================================

/**
 * 评估条件表达式
 */
export function evaluateCondition(condition: string, context: WorkflowContext): boolean {
    try {
        // 替换变量
        let evalStr = condition.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
            const value = parseVariableExpression(`{{${expr}}}`, context);
            if (typeof value === 'string') return `"${value}"`;
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        });

        // 安全评估（仅支持基本比较）
        // 支持: ==, !=, <, >, <=, >=, &&, ||, !
        if (/[^a-zA-Z0-9\s<>=!&|"'\-._\[\]]/.test(evalStr)) {
            console.warn('[WorkflowVars] Unsafe condition:', evalStr);
            return false;
        }

        // 使用 Function 而非 eval
        const fn = new Function(`return ${evalStr}`);
        return Boolean(fn());
    } catch (e) {
        console.error('[WorkflowVars] Condition evaluation failed:', e);
        return false;
    }
}

// ============================================
// Workflow Variables Class
// ============================================

export class WorkflowVariables {
    private context: WorkflowContext = {
        variables: new Map(),
        loopStack: []
    };

    /**
     * 设置变量
     */
    set(name: string, value: VariableValue): void {
        this.context.variables.set(name, value);
    }

    /**
     * 获取变量
     */
    get(name: string): VariableValue | undefined {
        return this.context.variables.get(name);
    }

    /**
     * 获取所有变量
     */
    getAll(): Record<string, VariableValue> {
        return Object.fromEntries(this.context.variables);
    }

    /**
     * 删除变量
     */
    delete(name: string): boolean {
        return this.context.variables.delete(name);
    }

    /**
     * 清空所有变量
     */
    clear(): void {
        this.context.variables.clear();
        this.context.loopStack = [];
    }

    /**
     * 插值字符串
     */
    interpolate(template: string): string {
        return interpolateString(template, this.context);
    }

    /**
     * 评估条件
     */
    evaluate(condition: string): boolean {
        return evaluateCondition(condition, this.context);
    }

    /**
     * 进入循环
     */
    enterLoop(variable: string, items: any[]): void {
        this.context.loopStack.push({ variable, index: 0, items });
    }

    /**
     * 循环下一项
     */
    nextLoopItem(): boolean {
        const current = this.context.loopStack[this.context.loopStack.length - 1];
        if (!current) return false;

        current.index++;
        return current.index < current.items.length;
    }

    /**
     * 退出循环
     */
    exitLoop(): void {
        this.context.loopStack.pop();
    }

    /**
     * 获取当前循环索引
     */
    getLoopIndex(): number {
        const current = this.context.loopStack[this.context.loopStack.length - 1];
        return current?.index ?? -1;
    }

    /**
     * 获取当前循环项
     */
    getLoopItem<T = any>(): T | undefined {
        const current = this.context.loopStack[this.context.loopStack.length - 1];
        if (!current) return undefined;
        return current.items[current.index];
    }

    /**
     * 从提取的数据创建变量
     */
    setFromExtracted(data: Record<string, any>): void {
        for (const [key, value] of Object.entries(data)) {
            this.set(key, value);
        }
    }

    /**
     * 计算变量（基于表达式）
     */
    compute(name: string, expression: string): VariableValue {
        const value = this.interpolate(expression);
        this.set(name, value);
        return value;
    }

    /**
     * 导出上下文（用于持久化）
     */
    export(): Record<string, VariableValue> {
        return Object.fromEntries(this.context.variables);
    }

    /**
     * 导入上下文
     */
    import(data: Record<string, VariableValue>): void {
        for (const [key, value] of Object.entries(data)) {
            this.set(key, value);
        }
    }
}

// ============================================
// Singleton Instance
// ============================================

export const workflowVariables = new WorkflowVariables();

export default workflowVariables;
