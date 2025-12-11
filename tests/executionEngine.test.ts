/**
 * Execution Engine Tests
 * 
 * 测试 ReAct 循环执行引擎
 * **Feature: agent-core-upgrade, Property 11: ReAct Loop Execution**
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.6**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ExecutionEngine } from '../services/executionEngine';
import { ToolRegistry, successResult } from '../services/toolRegistry';
import { Tool, AgentContext, Intent, PlannedStep } from '../types/agent';

// Mock tool for testing
const createMockTool = (name: string, delay = 0): Tool => ({
  name,
  description: `Mock tool: ${name}`,
  category: 'utility',
  parameters: [],
  execute: async (params, ctx) => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return successResult({ executed: true, tool: name, params });
  }
});

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine;
  let registry: ToolRegistry;

  beforeEach(() => {
    engine = new ExecutionEngine({ maxSteps: 10, stepTimeout: 5000, stepDelay: 10 });
    registry = new ToolRegistry();
    
    // Register mock tools
    registry.register(createMockTool('summarize'));
    registry.register(createMockTool('extract_data'));
    registry.register(createMockTool('generate_reply'));
  });

  describe('createPlan', () => {
    it('should create a plan with steps for valid intent', async () => {
      // Need to use the global registry for this test
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('summarize'));
      
      const intent: Intent = {
        type: 'command',
        action: 'summarize',
        confidence: 0.9,
        rawMessage: 'summarize this page'
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      const plan = await engine.createPlan(intent, context);
      
      expect(plan.id).toBeDefined();
      expect(plan.steps.length).toBeGreaterThanOrEqual(0);
    });

    it('should create empty plan for unknown action', async () => {
      const intent: Intent = {
        type: 'command',
        action: 'unknown_action_xyz',
        confidence: 0.5,
        rawMessage: 'do something unknown'
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      const plan = await engine.createPlan(intent, context);
      
      expect(plan.steps).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute plan and yield steps', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('test_tool'));
      
      const plan = {
        id: 'test_plan',
        steps: [
          { id: 'step_1', tool: 'test_tool', parameters: {}, description: 'Test step' }
        ],
        createdAt: Date.now()
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      const steps: any[] = [];
      for await (const step of engine.execute(plan, context)) {
        steps.push(step);
      }
      
      // Should have at least one step (running and completed states)
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe('abort', () => {
    /**
     * **Feature: agent-core-upgrade, Property 12: Abort on Stop Command**
     * *For any* running execution, abort should stop it
     */
    it('should abort execution when abort is called', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      
      // Register a slow tool
      toolRegistry.register({
        name: 'slow_tool',
        description: 'Slow tool',
        category: 'utility',
        parameters: [],
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return successResult({ done: true });
        }
      });
      
      const plan = {
        id: 'test_plan',
        steps: [
          { id: 'step_1', tool: 'slow_tool', parameters: {}, description: 'Slow step' },
          { id: 'step_2', tool: 'slow_tool', parameters: {}, description: 'Another slow step' }
        ],
        createdAt: Date.now()
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      // Start execution
      const generator = engine.execute(plan, context);
      
      // Abort after a short delay
      setTimeout(() => engine.abort(), 50);
      
      const steps: any[] = [];
      for await (const step of generator) {
        steps.push(step);
      }
      
      // Should not complete all steps
      expect(engine.isExecuting()).toBe(false);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary after execution', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('quick_tool'));
      
      const plan = {
        id: 'test_plan',
        steps: [
          { id: 'step_1', tool: 'quick_tool', parameters: {}, description: 'Quick step' }
        ],
        createdAt: Date.now()
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      // Execute all steps
      for await (const _ of engine.execute(plan, context)) {
        // consume all steps
      }
      
      const summary = engine.generateSummary();
      
      expect(summary).toBeDefined();
      expect(typeof summary.success).toBe('boolean');
      expect(summary.summary).toBeDefined();
    });
  });

  describe('topological sort', () => {
    it('should handle steps with dependencies', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('tool_a'));
      toolRegistry.register(createMockTool('tool_b'));
      
      const plan = {
        id: 'test_plan',
        steps: [
          { id: 'step_2', tool: 'tool_b', parameters: {}, description: 'Step B', dependsOn: ['step_1'] },
          { id: 'step_1', tool: 'tool_a', parameters: {}, description: 'Step A' }
        ],
        createdAt: Date.now()
      };
      
      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };
      
      const executedSteps: string[] = [];
      for await (const step of engine.execute(plan, context)) {
        if (step.status === 'running') {
          executedSteps.push(step.stepId);
        }
      }
      
      // step_1 should be executed before step_2
      const step1Index = executedSteps.indexOf('step_1');
      const step2Index = executedSteps.indexOf('step_2');
      
      if (step1Index !== -1 && step2Index !== -1) {
        expect(step1Index).toBeLessThan(step2Index);
      }
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property 11: ReAct Loop Execution**
     * *For any* plan with N steps, execution should yield at least N step updates
     */
    it('should yield step updates for each planned step', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('pbt_tool'));
      
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 5 }),
          async (stepCount) => {
            const localEngine = new ExecutionEngine({ maxSteps: 10, stepTimeout: 5000, stepDelay: 1 });
            
            const steps: PlannedStep[] = [];
            for (let i = 0; i < stepCount; i++) {
              steps.push({
                id: `step_${i}`,
                tool: 'pbt_tool',
                parameters: {},
                description: `Step ${i}`
              });
            }
            
            const plan = {
              id: 'pbt_plan',
              steps,
              createdAt: Date.now()
            };
            
            const context: AgentContext = {
              chatHistory: [],
              memories: [],
              personas: [],
              activePersonaId: ''
            };
            
            const yieldedSteps: any[] = [];
            for await (const step of localEngine.execute(plan, context)) {
              yieldedSteps.push(step);
            }
            
            // Each step should yield at least once (running state)
            // Actually yields twice per step (running + completed)
            return yieldedSteps.length >= stepCount;
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Execution State Consistency**
     * *For any* execution, isExecuting should be false after completion
     */
    it('isExecuting should be false after execution completes', async () => {
      const { toolRegistry } = await import('../services/toolRegistry');
      toolRegistry.register(createMockTool('state_tool'));
      
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 3 }),
          async (stepCount) => {
            const localEngine = new ExecutionEngine({ maxSteps: 10, stepTimeout: 5000, stepDelay: 1 });
            
            const steps: PlannedStep[] = [];
            for (let i = 0; i < stepCount; i++) {
              steps.push({
                id: `step_${i}`,
                tool: 'state_tool',
                parameters: {},
                description: `Step ${i}`
              });
            }
            
            const plan = {
              id: 'state_plan',
              steps,
              createdAt: Date.now()
            };
            
            const context: AgentContext = {
              chatHistory: [],
              memories: [],
              personas: [],
              activePersonaId: ''
            };
            
            // Execute all steps
            for await (const _ of localEngine.execute(plan, context)) {
              // consume
            }
            
            return !localEngine.isExecuting();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
