/**
 * Execution Engine
 * 
 * ReAct 循环执行引擎：
 * - 创建执行计划
 * - 执行工具调用
 * - 处理观察结果
 * - 支持中断和恢复
 */

import {
  ExecutionPlan,
  PlannedStep,
  ExecutionStep,
  ExecutionResult,
  AgentContext,
  ToolCall,
  ToolResult,
  Intent,
  ProgressUpdate
} from '../types/agent';
import { toolRegistry, createToolCallId } from './toolRegistry';

// ============================================
// Types
// ============================================

export interface ExecutionEngineConfig {
  /** 最大执行步骤数 */
  maxSteps: number;
  /** 单步超时时间（毫秒） */
  stepTimeout: number;
  /** 步骤间延迟（毫秒） */
  stepDelay: number;
}

const DEFAULT_CONFIG: ExecutionEngineConfig = {
  maxSteps: 10,
  stepTimeout: 30000,
  stepDelay: 100
};

// ============================================
// Execution Engine Class
// ============================================

export class ExecutionEngine {
  private config: ExecutionEngineConfig;
  private abortController: AbortController | null = null;
  private isRunning: boolean = false;
  private currentPlan: ExecutionPlan | null = null;
  private executedSteps: ExecutionStep[] = [];
  
  constructor(config: Partial<ExecutionEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 创建执行计划
   */
  async createPlan(intent: Intent, context: AgentContext): Promise<ExecutionPlan> {
    const steps: PlannedStep[] = [];
    
    // 根据意图创建步骤
    if (intent.action) {
      const tool = toolRegistry.findByIntent(intent);
      
      if (tool) {
        steps.push({
          id: `step_${Date.now()}_1`,
          tool: tool.name,
          parameters: intent.parameters || {},
          description: `Execute ${tool.name} for: ${intent.rawMessage}`
        });
      }
    }
    
    // 如果没有找到工具，创建一个空计划
    if (steps.length === 0) {
      // 可能是纯对话，不需要工具
    }
    
    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      steps,
      estimatedDuration: steps.length * 2000,
      createdAt: Date.now()
    };
    
    this.currentPlan = plan;
    return plan;
  }
  
  /**
   * 执行计划（异步生成器）
   */
  async *execute(
    plan: ExecutionPlan,
    context: AgentContext,
    onStep?: (step: ExecutionStep) => void
  ): AsyncGenerator<ExecutionStep> {
    this.isRunning = true;
    this.abortController = new AbortController();
    this.executedSteps = [];
    
    const startTime = Date.now();
    
    try {
      // 按依赖顺序执行步骤
      const sortedSteps = this.topologicalSort(plan.steps);
      
      for (let i = 0; i < sortedSteps.length; i++) {
        // 检查是否被中断
        if (this.abortController.signal.aborted) {
          break;
        }
        
        const plannedStep = sortedSteps[i];
        
        // 创建执行步骤
        const execStep: ExecutionStep = {
          stepId: plannedStep.id,
          status: 'running',
          thought: `Executing ${plannedStep.tool}...`,
          action: plannedStep.description,
          startedAt: Date.now()
        };
        
        // 通知步骤开始
        onStep?.(execStep);
        yield execStep;
        
        try {
          // 执行工具
          const toolCall: ToolCall = {
            tool: plannedStep.tool,
            parameters: plannedStep.parameters,
            callId: createToolCallId()
          };
          
          const result = await this.executeWithTimeout(
            toolRegistry.execute(toolCall, context),
            this.config.stepTimeout
          );
          
          // 更新步骤状态
          execStep.status = result.success ? 'completed' : 'failed';
          execStep.observation = result.displayText || JSON.stringify(result.data);
          execStep.completedAt = Date.now();
          
          if (!result.success) {
            execStep.error = result.error;
          }
          
        } catch (error) {
          execStep.status = 'failed';
          execStep.error = error instanceof Error ? error.message : String(error);
          execStep.completedAt = Date.now();
        }
        
        this.executedSteps.push(execStep);
        
        // 通知步骤完成
        onStep?.(execStep);
        yield execStep;
        
        // 步骤间延迟
        if (i < sortedSteps.length - 1) {
          await this.delay(this.config.stepDelay);
        }
      }
      
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }
  
  /**
   * 执行单个工具调用
   */
  async executeSingleTool(
    toolName: string,
    parameters: Record<string, any>,
    context: AgentContext
  ): Promise<ToolResult> {
    const toolCall: ToolCall = {
      tool: toolName,
      parameters,
      callId: createToolCallId()
    };
    
    return toolRegistry.execute(toolCall, context);
  }
  
  /**
   * 中断执行
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
  }
  
  /**
   * 检查是否正在运行
   */
  isExecuting(): boolean {
    return this.isRunning;
  }
  
  /**
   * 获取当前计划
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }
  
  /**
   * 获取已执行的步骤
   */
  getExecutedSteps(): ExecutionStep[] {
    return [...this.executedSteps];
  }
  
  /**
   * 生成执行结果摘要
   */
  generateSummary(): ExecutionResult {
    const completedSteps = this.executedSteps.filter(s => s.status === 'completed');
    const failedSteps = this.executedSteps.filter(s => s.status === 'failed');
    
    const success = failedSteps.length === 0 && completedSteps.length > 0;
    
    let summary = '';
    if (success) {
      summary = `Successfully completed ${completedSteps.length} step(s).`;
      const observations = completedSteps
        .filter(s => s.observation)
        .map(s => s.observation);
      if (observations.length > 0) {
        summary += '\n\nResults:\n' + observations.join('\n');
      }
    } else if (failedSteps.length > 0) {
      summary = `Execution failed at step: ${failedSteps[0].stepId}`;
      if (failedSteps[0].error) {
        summary += `\nError: ${failedSteps[0].error}`;
      }
    } else {
      summary = 'No steps were executed.';
    }
    
    const duration = this.executedSteps.length > 0
      ? (this.executedSteps[this.executedSteps.length - 1].completedAt || Date.now()) -
        (this.executedSteps[0].startedAt || Date.now())
      : 0;
    
    return {
      success,
      completedSteps: this.executedSteps,
      summary,
      error: failedSteps[0]?.error,
      duration
    };
  }
  
  /**
   * 拓扑排序（处理步骤依赖）
   */
  private topologicalSort(steps: PlannedStep[]): PlannedStep[] {
    // 简单实现：如果没有依赖，按原顺序返回
    // 完整实现需要处理 dependsOn 字段
    
    const sorted: PlannedStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const stepMap = new Map(steps.map(s => [s.id, s]));
    
    const visit = (step: PlannedStep) => {
      if (visited.has(step.id)) return;
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected at step: ${step.id}`);
      }
      
      visiting.add(step.id);
      
      // 先访问依赖
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          const depStep = stepMap.get(depId);
          if (depStep) {
            visit(depStep);
          }
        }
      }
      
      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };
    
    for (const step of steps) {
      visit(step);
    }
    
    return sorted;
  }
  
  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout)
      )
    ]);
  }
  
  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 重置状态
   */
  reset(): void {
    this.abort();
    this.currentPlan = null;
    this.executedSteps = [];
  }
}

// ============================================
// Singleton Instance
// ============================================

export const executionEngine = new ExecutionEngine();

export default executionEngine;
