/**
 * Multi-Tool Sequencing Tests
 * 
 * 测试多工具编排和依赖执行
 * **Feature: agent-core-upgrade, Property 6: Multi-Tool Sequencing**
 * **Validates: Requirements 2.5**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ExecutionEngine } from '../services/executionEngine';
import { ToolRegistry, successResult } from '../services/toolRegistry';
import { Tool, AgentContext, PlannedStep } from '../types/agent';

// Track execution order
let executionOrder: string[] = [];

// Create a tool that records its execution
const createOrderTrackingTool = (name: string): Tool => ({
  name,
  description: `Order tracking tool: ${name}`,
  category: 'utility',
  parameters: [],
  execute: async (params, ctx) => {
    executionOrder.push(name);
    return successResult({ executed: true, tool: name, order: executionOrder.length });
  }
});

describe('Multi-Tool Sequencing', () => {
  let engine: ExecutionEngine;

  beforeEach(async () => {
    engine = new ExecutionEngine({ maxSteps: 20, stepTimeout: 5000, stepDelay: 1 });
    executionOrder = [];
    
    // Register tools in the global registry
    const { toolRegistry } = await import('../services/toolRegistry');
    toolRegistry.clear();
    toolRegistry.register(createOrderTrackingTool('tool_a'));
    toolRegistry.register(createOrderTrackingTool('tool_b'));
    toolRegistry.register(createOrderTrackingTool('tool_c'));
    toolRegistry.register(createOrderTrackingTool('tool_d'));
    toolRegistry.register(createOrderTrackingTool('tool_e'));
  });

  describe('Dependency-Based Execution Order', () => {
    /**
     * **Feature: agent-core-upgrade, Property 6: Multi-Tool Sequencing**
     * *For any* execution plan with dependencies, tools should execute in topological order
     */
    it('should execute tools respecting dependencies', async () => {
      const plan = {
        id: 'dep_plan',
        steps: [
          { id: 'step_c', tool: 'tool_c', parameters: {}, description: 'Step C', dependsOn: ['step_a', 'step_b'] },
          { id: 'step_a', tool: 'tool_a', parameters: {}, description: 'Step A' },
          { id: 'step_b', tool: 'tool_b', parameters: {}, description: 'Step B', dependsOn: ['step_a'] }
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
        // consume
      }

      // Verify order: A must come before B, and both A and B must come before C
      const indexA = executionOrder.indexOf('tool_a');
      const indexB = executionOrder.indexOf('tool_b');
      const indexC = executionOrder.indexOf('tool_c');

      expect(indexA).toBeLessThan(indexB); // A before B
      expect(indexA).toBeLessThan(indexC); // A before C
      expect(indexB).toBeLessThan(indexC); // B before C
    });

    it('should handle linear dependency chain', async () => {
      const plan = {
        id: 'chain_plan',
        steps: [
          { id: 'step_d', tool: 'tool_d', parameters: {}, description: 'Step D', dependsOn: ['step_c'] },
          { id: 'step_c', tool: 'tool_c', parameters: {}, description: 'Step C', dependsOn: ['step_b'] },
          { id: 'step_b', tool: 'tool_b', parameters: {}, description: 'Step B', dependsOn: ['step_a'] },
          { id: 'step_a', tool: 'tool_a', parameters: {}, description: 'Step A' }
        ],
        createdAt: Date.now()
      };

      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };

      for await (const _ of engine.execute(plan, context)) {
        // consume
      }

      // Should execute in order: A -> B -> C -> D
      expect(executionOrder).toEqual(['tool_a', 'tool_b', 'tool_c', 'tool_d']);
    });

    it('should handle parallel independent steps', async () => {
      const plan = {
        id: 'parallel_plan',
        steps: [
          { id: 'step_a', tool: 'tool_a', parameters: {}, description: 'Step A' },
          { id: 'step_b', tool: 'tool_b', parameters: {}, description: 'Step B' },
          { id: 'step_c', tool: 'tool_c', parameters: {}, description: 'Step C' }
        ],
        createdAt: Date.now()
      };

      const context: AgentContext = {
        chatHistory: [],
        memories: [],
        personas: [],
        activePersonaId: ''
      };

      for await (const _ of engine.execute(plan, context)) {
        // consume
      }

      // All three should execute (order may vary for independent steps)
      expect(executionOrder).toHaveLength(3);
      expect(executionOrder).toContain('tool_a');
      expect(executionOrder).toContain('tool_b');
      expect(executionOrder).toContain('tool_c');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property 6: Multi-Tool Sequencing**
     * *For any* plan with dependencies, dependent steps should always execute after their dependencies
     */
    it('dependent steps should always execute after dependencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 4 }),
          async (chainLength) => {
            const localEngine = new ExecutionEngine({ maxSteps: 20, stepTimeout: 5000, stepDelay: 1 });
            const localOrder: string[] = [];
            
            // Create tools that track order
            const { toolRegistry } = await import('../services/toolRegistry');
            for (let i = 0; i <= chainLength; i++) {
              const toolName = `chain_tool_${i}`;
              if (!toolRegistry.has(toolName)) {
                toolRegistry.register({
                  name: toolName,
                  description: `Chain tool ${i}`,
                  category: 'utility',
                  parameters: [],
                  execute: async () => {
                    localOrder.push(toolName);
                    return successResult({ executed: true });
                  }
                });
              }
            }
            
            // Create a chain of dependencies
            const steps: PlannedStep[] = [];
            for (let i = chainLength; i >= 0; i--) {
              steps.push({
                id: `step_${i}`,
                tool: `chain_tool_${i}`,
                parameters: {},
                description: `Step ${i}`,
                dependsOn: i > 0 ? [`step_${i - 1}`] : undefined
              });
            }
            
            const plan = {
              id: 'chain_test_plan',
              steps,
              createdAt: Date.now()
            };
            
            const context: AgentContext = {
              chatHistory: [],
              memories: [],
              personas: [],
              activePersonaId: ''
            };
            
            for await (const _ of localEngine.execute(plan, context)) {
              // consume
            }
            
            // Verify order: each step should come after its dependency
            for (let i = 1; i <= chainLength; i++) {
              const depIndex = localOrder.indexOf(`chain_tool_${i - 1}`);
              const stepIndex = localOrder.indexOf(`chain_tool_${i}`);
              if (depIndex !== -1 && stepIndex !== -1) {
                if (depIndex >= stepIndex) {
                  return false; // Dependency executed after dependent
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: All Steps Execute**
     * *For any* valid plan, all steps should eventually execute
     */
    it('all steps in a valid plan should execute', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 5 }),
          async (stepCount) => {
            if (stepCount === 0) return true; // Skip empty plans
            
            const localEngine = new ExecutionEngine({ maxSteps: 20, stepTimeout: 5000, stepDelay: 1 });
            const executedTools = new Set<string>();
            const runId = Date.now() + Math.random();
            
            const { toolRegistry } = await import('../services/toolRegistry');
            
            // Create independent tools with unique names per run
            const steps: PlannedStep[] = [];
            for (let i = 0; i < stepCount; i++) {
              const toolName = `all_steps_tool_${runId}_${i}`;
              toolRegistry.register({
                name: toolName,
                description: `All steps tool ${i}`,
                category: 'utility',
                parameters: [],
                execute: async () => {
                  executedTools.add(toolName);
                  return successResult({ executed: true });
                }
              });
              steps.push({
                id: `step_${i}`,
                tool: toolName,
                parameters: {},
                description: `Step ${i}`
              });
            }
            
            const plan = {
              id: 'all_steps_plan',
              steps,
              createdAt: Date.now()
            };
            
            const context: AgentContext = {
              chatHistory: [],
              memories: [],
              personas: [],
              activePersonaId: ''
            };
            
            for await (const _ of localEngine.execute(plan, context)) {
              // consume
            }
            
            // All tools should have executed
            return executedTools.size === stepCount;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
