/**
 * Action Recorder Service
 * 
 * 操作录制与回放：
 * - 记录用户操作（点击、输入、滚动等）
 * - 生成可回放的操作序列
 * - 支持工作流保存和加载
 */

// ============================================
// Types
// ============================================

export type RecordedActionType = 'click' | 'fill' | 'scroll' | 'select' | 'navigate' | 'wait';

export interface RecordedAction {
    /** 动作 ID */
    id: string;
    /** 动作类型 */
    type: RecordedActionType;
    /** 目标选择器 */
    selector?: string;
    /** 目标描述（自然语言） */
    description?: string;
    /** 输入值 */
    value?: string;
    /** 元素文本（用于验证） */
    elementText?: string;
    /** 时间戳 */
    timestamp: number;
    /** 距离上一步的延迟（毫秒） */
    delay: number;
    /** 截图 (base64) */
    screenshot?: string;
}

export interface Workflow {
    /** 工作流 ID */
    id: string;
    /** 工作流名称 */
    name: string;
    /** 描述 */
    description?: string;
    /** 操作序列 */
    actions: RecordedAction[];
    /** 起始 URL */
    startUrl?: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 标签 */
    tags?: string[];
}

export interface RecordingState {
    /** 是否正在录制 */
    isRecording: boolean;
    /** 录制的操作 */
    actions: RecordedAction[];
    /** 录制开始时间 */
    startTime: number | null;
    /** 上一个操作的时间 */
    lastActionTime: number | null;
}

export interface PlaybackOptions {
    /** 播放速度倍率 */
    speed?: number;
    /** 是否跳过延迟 */
    skipDelays?: boolean;
    /** 每步之间的固定延迟 */
    stepDelay?: number;
    /** 是否在每步暂停等待确认 */
    pauseOnEach?: boolean;
    /** 停止条件 */
    stopOnError?: boolean;
}

// ============================================
// Storage Constants
// ============================================

const STORAGE_KEY_WORKFLOWS = 'socialsage_workflows';
const STORAGE_KEY_RECORDING = 'socialsage_current_recording';

// ============================================
// Action Recorder Class
// ============================================

class ActionRecorder {
    private state: RecordingState = {
        isRecording: false,
        actions: [],
        startTime: null,
        lastActionTime: null
    };

    private listeners: Set<(state: RecordingState) => void> = new Set();

    // ============================================
    // Recording Control
    // ============================================

    /**
     * 开始录制
     */
    startRecording(startUrl?: string): void {
        const now = Date.now();
        this.state = {
            isRecording: true,
            actions: [],
            startTime: now,
            lastActionTime: now
        };

        // 如果有起始 URL，记录导航动作
        if (startUrl) {
            this.recordAction({
                type: 'navigate',
                value: startUrl,
                description: `Navigate to ${startUrl}`
            });
        }

        this.notifyListeners();
        console.log('[ActionRecorder] Recording started');
    }

    /**
     * 停止录制
     */
    stopRecording(): RecordedAction[] {
        const actions = [...this.state.actions];
        this.state = {
            isRecording: false,
            actions: [],
            startTime: null,
            lastActionTime: null
        };

        this.notifyListeners();
        console.log(`[ActionRecorder] Recording stopped. ${actions.length} actions captured.`);

        return actions;
    }

    /**
     * 暂停录制
     */
    pauseRecording(): void {
        if (this.state.isRecording) {
            this.state = { ...this.state, isRecording: false };
            this.notifyListeners();
        }
    }

    /**
     * 恢复录制
     */
    resumeRecording(): void {
        if (!this.state.isRecording && this.state.startTime) {
            this.state = { ...this.state, isRecording: true, lastActionTime: Date.now() };
            this.notifyListeners();
        }
    }

    /**
     * 录制一个动作
     */
    recordAction(action: Omit<RecordedAction, 'id' | 'timestamp' | 'delay'>): void {
        if (!this.state.isRecording) return;

        const now = Date.now();
        const delay = this.state.lastActionTime ? now - this.state.lastActionTime : 0;

        const recordedAction: RecordedAction = {
            ...action,
            id: `action_${now}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: now,
            delay: Math.min(delay, 10000) // 最大延迟 10 秒
        };

        this.state.actions.push(recordedAction);
        this.state.lastActionTime = now;

        this.notifyListeners();
        console.log(`[ActionRecorder] Recorded: ${action.type}`, action);
    }

    /**
     * 获取录制状态
     */
    getState(): RecordingState {
        return { ...this.state };
    }

    /**
     * 获取当前录制的操作
     */
    getRecordedActions(): RecordedAction[] {
        return [...this.state.actions];
    }

    // ============================================
    // Workflow Management
    // ============================================

    /**
     * 保存为工作流
     */
    saveWorkflow(name: string, description?: string, tags?: string[]): Workflow {
        const actions = this.stopRecording();

        const workflow: Workflow = {
            id: `workflow_${Date.now()}`,
            name,
            description,
            actions,
            startUrl: actions.find(a => a.type === 'navigate')?.value,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags
        };

        // 保存到 localStorage
        const workflows = this.loadWorkflows();
        workflows.push(workflow);
        this.saveWorkflowsToStorage(workflows);

        return workflow;
    }

    /**
     * 加载所有工作流
     */
    loadWorkflows(): Workflow[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_WORKFLOWS);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('[ActionRecorder] Failed to load workflows:', e);
            return [];
        }
    }

    /**
     * 获取单个工作流
     */
    getWorkflow(id: string): Workflow | undefined {
        return this.loadWorkflows().find(w => w.id === id);
    }

    /**
     * 删除工作流
     */
    deleteWorkflow(id: string): boolean {
        const workflows = this.loadWorkflows();
        const filtered = workflows.filter(w => w.id !== id);
        if (filtered.length < workflows.length) {
            this.saveWorkflowsToStorage(filtered);
            return true;
        }
        return false;
    }

    /**
     * 更新工作流
     */
    updateWorkflow(id: string, updates: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Workflow | null {
        const workflows = this.loadWorkflows();
        const index = workflows.findIndex(w => w.id === id);
        if (index === -1) return null;

        workflows[index] = {
            ...workflows[index],
            ...updates,
            updatedAt: Date.now()
        };

        this.saveWorkflowsToStorage(workflows);
        return workflows[index];
    }

    private saveWorkflowsToStorage(workflows: Workflow[]): void {
        try {
            localStorage.setItem(STORAGE_KEY_WORKFLOWS, JSON.stringify(workflows));
        } catch (e) {
            console.error('[ActionRecorder] Failed to save workflows:', e);
        }
    }

    // ============================================
    // Playback
    // ============================================

    /**
     * 回放工作流
     */
    async playWorkflow(
        workflow: Workflow,
        executeAction: (action: RecordedAction) => Promise<boolean>,
        options: PlaybackOptions = {},
        onProgress?: (index: number, total: number, action: RecordedAction) => void
    ): Promise<{ success: boolean; completedSteps: number; error?: string }> {
        const {
            speed = 1,
            skipDelays = false,
            stepDelay = 500,
            stopOnError = true
        } = options;

        let completedSteps = 0;

        for (let i = 0; i < workflow.actions.length; i++) {
            const action = workflow.actions[i];

            // 通知进度
            onProgress?.(i, workflow.actions.length, action);

            // 计算延迟
            if (!skipDelays && i > 0) {
                const delay = stepDelay || Math.round(action.delay / speed);
                await this.sleep(delay);
            }

            try {
                const success = await executeAction(action);
                if (!success && stopOnError) {
                    return {
                        success: false,
                        completedSteps,
                        error: `Failed at step ${i + 1}: ${action.type} on ${action.selector || action.description}`
                    };
                }
                completedSteps++;
            } catch (error) {
                if (stopOnError) {
                    return {
                        success: false,
                        completedSteps,
                        error: `Error at step ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
                    };
                }
            }
        }

        return { success: true, completedSteps };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // Event Listeners
    // ============================================

    /**
     * 订阅状态变化
     */
    subscribe(listener: (state: RecordingState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        const state = this.getState();
        this.listeners.forEach(listener => listener(state));
    }
}

// ============================================
// Singleton Instance
// ============================================

export const actionRecorder = new ActionRecorder();

export default actionRecorder;
