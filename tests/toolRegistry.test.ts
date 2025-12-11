/**
 * Tool Registry Tests
 * 
 * 测试工具注册和执行框架
 * **Feature: agent-core-upgrade, Property 4: Tool Execution Flow**
 * **Validates: Requirements 2.2, 2.3, 2.6**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ToolRegistry, createToolCall, successResult, errorResult } from '../services/toolRegistry';
import { Tool, ToolResult, AgentContext } from '../types/agent';

// Mock tool for testing
const createMockTool = (name: string, params: any[] = []): Tool => ({
  name,
  description: `Mock tool: ${name}`,
  category: 'utility',
  parameters: params,
  execute: async (p, ctx) => successResult({ executed: true, params: p })
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register and get', () => {
    it('should register and retrieve a tool', () => {
      const tool = createMockTool('test_tool');
      registry.register(tool);

      const retrieved = registry.get('test_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
    });

    it('should return undefined for non-existent tool', () => {
      const retrieved = registry.get('non_existent');
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing tool with same name', () => {
      const tool1 = createMockTool('test_tool');
      const tool2 = { ...createMockTool('test_tool'), description: 'Updated' };

      registry.register(tool1);
      registry.register(tool2);

      const retrieved = registry.get('test_tool');
      expect(retrieved?.description).toBe('Updated');
    });
  });

  describe('list', () => {
    it('should list all registered tools', () => {
      registry.register(createMockTool('tool1'));
      registry.register(createMockTool('tool2'));
      registry.register(createMockTool('tool3'));

      const tools = registry.list();
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('tool1');
      expect(tools.map(t => t.name)).toContain('tool2');
      expect(tools.map(t => t.name)).toContain('tool3');
    });
  });

  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const tool = createMockTool('test', [
        { name: 'required_param', type: 'string', description: 'Required', required: true }
      ]);

      const result = registry.validateParameters(tool, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: required_param');
    });

    it('should pass with all required parameters', () => {
      const tool = createMockTool('test', [
        { name: 'required_param', type: 'string', description: 'Required', required: true }
      ]);

      const result = registry.validateParameters(tool, { required_param: 'value' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate parameter types', () => {
      const tool = createMockTool('test', [
        { name: 'num_param', type: 'number', description: 'Number', required: true }
      ]);

      const result = registry.validateParameters(tool, { num_param: 'not a number' });
      expect(result.valid).toBe(false);
    });

    it('should validate enum values', () => {
      const tool = createMockTool('test', [
        { name: 'enum_param', type: 'string', description: 'Enum', required: true, enum: ['a', 'b', 'c'] }
      ]);

      const validResult = registry.validateParameters(tool, { enum_param: 'a' });
      expect(validResult.valid).toBe(true);

      const invalidResult = registry.validateParameters(tool, { enum_param: 'd' });
      expect(invalidResult.valid).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute tool and return result', async () => {
      const tool = createMockTool('test_tool');
      registry.register(tool);

      const toolCall = createToolCall('test_tool', { foo: 'bar' });
      const context = { chatHistory: [], memories: [], personas: [], activePersonaId: '' } as AgentContext;

      const result = await registry.execute(toolCall, context);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ executed: true, params: { foo: 'bar' } });
    });

    it('should return error for non-existent tool', async () => {
      const toolCall = createToolCall('non_existent', {});
      const context = { chatHistory: [], memories: [], personas: [], activePersonaId: '' } as AgentContext;

      const result = await registry.execute(toolCall, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fill default values', async () => {
      const tool: Tool = {
        name: 'test_defaults',
        description: 'Test defaults',
        category: 'utility',
        parameters: [
          { name: 'param1', type: 'string', description: 'Param 1', required: false, default: 'default_value' }
        ],
        execute: async (params) => successResult(params)
      };
      registry.register(tool);

      const toolCall = createToolCall('test_defaults', {});
      const context = { chatHistory: [], memories: [], personas: [], activePersonaId: '' } as AgentContext;

      const result = await registry.execute(toolCall, context);
      expect(result.success).toBe(true);
      expect(result.data.param1).toBe('default_value');
    });
  });

  describe('findByIntent', () => {
    beforeEach(() => {
      registry.register(createMockTool('summarize'));
      registry.register(createMockTool('extract_data'));
      registry.register(createMockTool('generate_reply'));
    });

    it('should find tool by direct name match', () => {
      const tool = registry.findByIntent({ type: 'command', action: 'summarize', confidence: 0.9, rawMessage: 'test' });
      expect(tool?.name).toBe('summarize');
    });

    it('should find tool by keyword match', () => {
      const tool = registry.findByIntent({ type: 'command', action: 'summary', confidence: 0.9, rawMessage: 'test' });
      expect(tool?.name).toBe('summarize');
    });

    it('should return null for unknown action', () => {
      const tool = registry.findByIntent({ type: 'command', action: 'unknown_action', confidence: 0.9, rawMessage: 'test' });
      expect(tool).toBeNull();
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property 4: Tool Execution Flow**
     * *For any* registered tool, execution should return a ToolResult with success boolean
     */
    it('execution should always return valid ToolResult', async () => {
      const tool = createMockTool('prop_test');
      registry.register(tool);

      await fc.assert(
        fc.asyncProperty(
          fc.record({ key: fc.string(), value: fc.string() }),
          async (params) => {
            const toolCall = createToolCall('prop_test', params);
            const context = { chatHistory: [], memories: [], personas: [], activePersonaId: '' } as AgentContext;

            const result = await registry.execute(toolCall, context);
            return typeof result.success === 'boolean' &&
              (result.success ? result.data !== undefined : result.error !== undefined);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Tool Registration Idempotence**
     * *For any* tool, registering it multiple times should result in exactly one entry
     */
    it('registering same tool multiple times should not duplicate', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length < 50),
          fc.nat({ max: 10 }),
          (toolName, repeatCount) => {
            const localRegistry = new ToolRegistry();
            const tool = createMockTool(toolName);

            for (let i = 0; i <= repeatCount; i++) {
              localRegistry.register(tool);
            }

            const tools = localRegistry.list();
            const matchingTools = tools.filter(t => t.name === toolName);
            return matchingTools.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Parameter Validation Consistency**
     * *For any* tool with required parameters, missing them should always fail validation
     */
    it('missing required parameters should always fail validation', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0 && s.length < 30),
          (paramName) => {
            const tool = createMockTool('test', [
              { name: paramName, type: 'string', description: 'Required', required: true }
            ]);

            const result = registry.validateParameters(tool, {});
            return !result.valid && result.errors.some(e => e.includes(paramName));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
