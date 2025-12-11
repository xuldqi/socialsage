/**
 * Error Handler Tests
 * 
 * 测试错误处理和降级策略
 * **Feature: agent-core-upgrade, Property 5: Tool Error Handling**
 * **Validates: Requirements 2.4, 6.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ErrorHandler } from '../services/errorHandler';
import { AgentErrorType } from '../types/agent';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
  });

  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const error = new Error('Request timeout');
      const category = handler.classifyError(error);
      expect(category).toBe('timeout');
    });

    it('should classify rate limit errors as llm_error', () => {
      const error = new Error('Rate limit exceeded');
      const category = handler.classifyError(error);
      expect(category).toBe('llm_error');
    });

    it('should classify API errors as llm_error', () => {
      const error = new Error('API quota exceeded');
      const category = handler.classifyError(error);
      expect(category).toBe('llm_error');
    });

    it('should classify validation errors', () => {
      const error = new Error('Invalid parameter: name');
      const category = handler.classifyError(error);
      expect(category).toBe('invalid_parameters');
    });

    it('should classify tool not found errors', () => {
      const error = new Error('Tool not found');
      const category = handler.classifyError(error);
      expect(category).toBe('tool_not_found');
    });

    it('should classify aborted errors', () => {
      const error = new Error('Operation aborted');
      const category = handler.classifyError(error);
      expect(category).toBe('aborted');
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = new Error('Something weird happened');
      const category = handler.classifyError(error);
      expect(category).toBe('unknown');
    });
  });

  describe('createAgentError', () => {
    it('should create error with suggestions', () => {
      const error = new Error('Tool execution failed');
      const agentError = handler.createAgentError(error, ['Try a different tool', 'Check parameters']);
      
      expect(agentError.message).toBeDefined();
      expect(agentError.type).toBe('tool_execution_failed');
      expect(agentError.suggestions).toHaveLength(2);
    });

    it('should include recoverable flag', () => {
      const error = new Error('Timeout occurred');
      const agentError = handler.createAgentError(error);
      
      expect(agentError.recoverable).toBe(true);
    });

    it('should mark aborted as non-recoverable', () => {
      const error = new Error('Operation aborted');
      const agentError = handler.createAgentError(error);
      
      expect(agentError.recoverable).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return localized message for timeout', () => {
      const message = handler.getErrorMessage('timeout');
      expect(message).toContain('timed out');
    });

    it('should return localized message for llm_error', () => {
      const message = handler.getErrorMessage('llm_error');
      expect(message).toContain('AI');
    });
  });

  describe('isRecoverable', () => {
    it('should return true for timeout errors', () => {
      expect(handler.isRecoverable('timeout')).toBe(true);
    });

    it('should return true for llm_error', () => {
      expect(handler.isRecoverable('llm_error')).toBe(true);
    });

    it('should return false for aborted', () => {
      expect(handler.isRecoverable('aborted')).toBe(false);
    });

    it('should return false for invalid_parameters', () => {
      expect(handler.isRecoverable('invalid_parameters')).toBe(false);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for timeout', () => {
      const suggestions = handler.getSuggestions('timeout');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return suggestions for llm_error', () => {
      const suggestions = handler.getSuggestions('llm_error');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.toLowerCase().includes('api'))).toBe(true);
    });
  });

  describe('formatForDisplay', () => {
    it('should format error with suggestions', () => {
      const agentError = handler.createAgentError(new Error('Test error'));
      const formatted = handler.formatForDisplay(agentError);
      
      expect(formatted).toContain('⚠️');
      expect(formatted).toContain('Suggestions');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property 5: Tool Error Handling**
     * *For any* error, createAgentError should return a result with message and suggestions
     */
    it('createAgentError should always return valid AgentError', () => {
      fc.assert(
        fc.property(fc.string(), (errorMessage) => {
          const error = new Error(errorMessage);
          const result = handler.createAgentError(error);
          
          return (
            typeof result.message === 'string' &&
            result.message.length > 0 &&
            Array.isArray(result.suggestions) &&
            typeof result.recoverable === 'boolean'
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Error Classification Consistency**
     * *For any* error, classifyError should return a valid type
     */
    it('classifyError should always return valid type', () => {
      const validTypes: AgentErrorType[] = [
        'tool_not_found', 'tool_execution_failed', 'invalid_parameters',
        'context_unavailable', 'llm_error', 'timeout', 'aborted', 'unknown'
      ];
      
      fc.assert(
        fc.property(fc.string(), (errorMessage) => {
          const error = new Error(errorMessage);
          const type = handler.classifyError(error);
          return validTypes.includes(type);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Recoverable Consistency**
     * *For any* error type, isRecoverable should return consistent results
     */
    it('isRecoverable should be consistent for same type', () => {
      const types: AgentErrorType[] = [
        'tool_not_found', 'tool_execution_failed', 'invalid_parameters',
        'context_unavailable', 'llm_error', 'timeout', 'aborted', 'unknown'
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...types),
          fc.nat({ max: 10 }),
          (type, _) => {
            const result1 = handler.isRecoverable(type);
            const result2 = handler.isRecoverable(type);
            return result1 === result2;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Suggestions Non-Empty**
     * *For any* error type, getSuggestions should return at least one suggestion
     */
    it('getSuggestions should always return at least one suggestion', () => {
      const types: AgentErrorType[] = [
        'tool_not_found', 'tool_execution_failed', 'invalid_parameters',
        'context_unavailable', 'llm_error', 'timeout', 'aborted', 'unknown'
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...types),
          (type) => {
            const suggestions = handler.getSuggestions(type);
            return suggestions.length > 0;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
