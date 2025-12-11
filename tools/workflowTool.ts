/**
 * Workflow Tool
 * 
 * 工作流相关工具：
 * - 录制用户操作
 * - 回放工作流
 * - 保存/加载工作流
 */

import { Tool, ToolResult, AgentContext } from '../types/agent';
import { successResult, errorResult } from '../services/toolRegistry';
import { actionRecorder, Workflow, RecordedAction } from '../services/actionRecorder';
import contentScriptBridge from '../services/contentScriptBridge';

// ============================================
// Types
// ============================================

type WorkflowAction = 'start_recording' | 'stop_recording' | 'play' | 'list' | 'delete' | 'save';

// ============================================
// Helper Functions
// ============================================

/**
 * 执行单个录制的动作
 */
async function executeRecordedAction(action: RecordedAction): Promise<boolean> {
    try {
        switch (action.type) {
            case 'click':
                if (!action.selector) return false;
                const clickResult = await contentScriptBridge.executeAction({
                    type: 'click',
                    selector: action.selector
                });
                return clickResult.success;

            case 'fill':
                if (!action.selector || !action.value) return false;
                const fillResult = await contentScriptBridge.executeAction({
                    type: 'fill',
                    selector: action.selector,
                    value: action.value
                });
                return fillResult.success;

            case 'scroll':
                const scrollResult = await contentScriptBridge.executeAction({
                    type: 'scroll',
                    selector: action.selector,
                    value: action.value || 'down'
                });
                return scrollResult.success;

            case 'select':
                if (!action.selector || !action.value) return false;
                const selectResult = await contentScriptBridge.executeAction({
                    type: 'select',
                    selector: action.selector,
                    value: action.value
                });
                return selectResult.success;

            case 'navigate':
                // 导航需要特殊处理
                console.log('[WorkflowTool] Navigate to:', action.value);
                return true;

            case 'wait':
                const waitTime = parseInt(action.value || '1000');
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return true;

            default:
                console.warn('[WorkflowTool] Unknown action type:', action.type);
                return false;
        }
    } catch (error) {
        console.error('[WorkflowTool] Action execution error:', error);
        return false;
    }
}

/**
 * 格式化工作流列表
 */
function formatWorkflowList(workflows: Workflow[]): string {
    if (workflows.length === 0) {
        return 'No saved workflows found.';
    }

    return workflows.map((w, i) => {
        const date = new Date(w.createdAt).toLocaleDateString();
        return `${i + 1}. **${w.name}** (${w.actions.length} steps) - Created: ${date}${w.description ? `\n   ${w.description}` : ''}`;
    }).join('\n');
}

// ============================================
// Workflow Tool Implementation
// ============================================

async function executeWorkflowCommand(
    params: Record<string, any>,
    context: AgentContext
): Promise<ToolResult> {
    const { action, workflowId, workflowName, description } = params;

    switch (action as WorkflowAction) {
        case 'start_recording': {
            const state = actionRecorder.getState();
            if (state.isRecording) {
                return errorResult(
                    'Already recording. Stop the current recording first.',
                    ['Use "stop recording" to end current session']
                );
            }

            const startUrl = context.pageContext?.metadata?.url;
            actionRecorder.startRecording(startUrl);

            return successResult(
                { status: 'recording_started', url: startUrl },
                '🔴 Recording started! I will capture your actions. Perform actions on the page and say "stop recording" when finished.'
            );
        }

        case 'stop_recording': {
            const state = actionRecorder.getState();
            if (!state.isRecording && state.actions.length === 0) {
                return errorResult(
                    'Not currently recording.',
                    ['Use "start recording" to begin']
                );
            }

            const actions = actionRecorder.stopRecording();

            if (actions.length === 0) {
                return successResult(
                    { status: 'recording_stopped', actionsCount: 0 },
                    '⏹️ Recording stopped. No actions were captured. Start a new recording to try again.'
                );
            }

            // 自动保存如果提供了名称
            if (workflowName) {
                const workflow = actionRecorder.saveWorkflow(workflowName, description);
                return successResult(
                    { status: 'saved', workflow },
                    `✅ Recording saved as "${workflowName}" with ${actions.length} actions. Use "play workflow" to run it or "list workflows" to see all saved.`
                );
            }

            return successResult(
                { status: 'recording_stopped', actions },
                `⏹️ Recording stopped. Captured ${actions.length} actions. Save with: save workflow "My Workflow"`
            );
        }

        case 'save': {
            if (!workflowName) {
                return errorResult(
                    'Workflow name is required.',
                    ['Provide a name: save workflow "My Workflow"']
                );
            }

            const state = actionRecorder.getState();
            if (state.actions.length === 0) {
                return errorResult(
                    'No actions to save. Start recording first.',
                    ['Start with "start recording"']
                );
            }

            const workflow = actionRecorder.saveWorkflow(workflowName, description);
            return successResult(
                { workflow },
                `✅ Workflow "${workflowName}" saved with ${workflow.actions.length} steps. Use "play workflow" to run it.`
            );
        }

        case 'play': {
            if (!workflowId && !workflowName) {
                return errorResult(
                    'Please specify which workflow to play.',
                    ['Use workflow ID or name', 'Use "list workflows" to see available']
                );
            }

            // 查找工作流
            const workflows = actionRecorder.loadWorkflows();
            let workflow = workflowId
                ? workflows.find(w => w.id === workflowId)
                : workflows.find(w => w.name.toLowerCase().includes(workflowName.toLowerCase()));

            if (!workflow) {
                return errorResult(
                    `Workflow "${workflowId || workflowName}" not found.`,
                    ['Use "list workflows" to see available workflows']
                );
            }

            // 执行工作流
            const result = await actionRecorder.playWorkflow(
                workflow,
                executeRecordedAction,
                { speed: 1, stepDelay: 800 },
                (index, total, action) => {
                    console.log(`[WorkflowTool] Step ${index + 1}/${total}: ${action.type}`);
                }
            );

            if (result.success) {
                return successResult(
                    { status: 'completed', completedSteps: result.completedSteps },
                    `✅ Workflow "${workflow.name}" completed successfully! (${result.completedSteps} steps). Run again or try another workflow.`
                );
            } else {
                return errorResult(
                    result.error || 'Workflow execution failed.',
                    ['Check if page state matches', 'Try running step by step']
                );
            }
        }

        case 'list': {
            const workflows = actionRecorder.loadWorkflows();
            const message = formatWorkflowList(workflows) + (workflows.length > 0 ? ' Use "play workflow [name]" to run.' : ' Start recording to create one.');
            return successResult(
                { workflows: workflows.map(w => ({ id: w.id, name: w.name, steps: w.actions.length })) },
                message
            );
        }

        case 'delete': {
            if (!workflowId && !workflowName) {
                return errorResult(
                    'Please specify which workflow to delete.',
                    ['Use workflow ID or name']
                );
            }

            const workflows = actionRecorder.loadWorkflows();
            const target = workflowId
                ? workflows.find(w => w.id === workflowId)
                : workflows.find(w => w.name.toLowerCase() === workflowName?.toLowerCase());

            if (!target) {
                return errorResult(`Workflow not found.`, ['Use "list workflows" to see available']);
            }

            actionRecorder.deleteWorkflow(target.id);
            return successResult(
                { deleted: target.id },
                `🗑️ Workflow "${target.name}" deleted.`
            );
        }

        default:
            return errorResult(
                `Unknown workflow action: ${action}`,
                ['Available: start_recording, stop_recording, play, list, save, delete']
            );
    }
}

// ============================================
// Tool Definition
// ============================================

export const workflowTool: Tool = {
    name: 'workflow',
    description: 'Record, save, and playback automated workflows. Use this to automate repetitive tasks by recording your actions and replaying them.',
    category: 'action',
    parameters: [
        {
            name: 'action',
            type: 'string',
            description: 'The workflow action to perform',
            required: true,
            enum: ['start_recording', 'stop_recording', 'play', 'list', 'save', 'delete']
        },
        {
            name: 'workflowId',
            type: 'string',
            description: 'ID of the workflow (for play/delete)',
            required: false
        },
        {
            name: 'workflowName',
            type: 'string',
            description: 'Name of the workflow (for save/play/delete)',
            required: false
        },
        {
            name: 'description',
            type: 'string',
            description: 'Description for the workflow (when saving)',
            required: false
        }
    ],
    execute: executeWorkflowCommand
};

export default workflowTool;
