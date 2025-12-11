/**
 * Intent Tracker Tests
 * 
 * 测试多轮对话意图追踪功能
 * **Feature: agent-core-upgrade, Property 1: Intent Analysis**
 * **Validates: Requirements 1.2, 1.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { IntentTracker } from '../services/intentTracker';
import { ChatMessage } from '../types';

describe('IntentTracker', () => {
  let tracker: IntentTracker;

  beforeEach(() => {
    tracker = new IntentTracker();
  });

  describe('analyzeIntent', () => {
    it('should detect summarize action', () => {
      const intent = tracker.analyzeIntent('summarize this page', []);
      expect(intent.action).toBe('summarize');
      expect(intent.target).toBe('page');
      expect(intent.type).toBe('command');
    });

    it('should detect extract action with entity type', () => {
      const intent = tracker.analyzeIntent('extract all emails from this page', []);
      expect(intent.action).toBe('extract');
      expect(intent.parameters.entityType).toBe('email');
    });

    it('should detect reply action', () => {
      const intent = tracker.analyzeIntent('reply to this post', []);
      expect(intent.action).toBe('reply');
      expect(intent.target).toBe('post');
    });

    it('should detect confirmation intent', () => {
      const intent = tracker.analyzeIntent('yes', []);
      expect(intent.type).toBe('confirmation');
      expect(intent.confidence).toBeGreaterThan(0.9);
    });

    it('should detect query intent', () => {
      // Use a query without action keywords - "why" doesn't trigger any action
      const intent = tracker.analyzeIntent('why did that happen?', []);
      expect(intent.type).toBe('query');
    });

    it('should handle Chinese commands', () => {
      const intent = tracker.analyzeIntent('总结这个页面', []);
      expect(intent.action).toBe('summarize');
      expect(intent.target).toBe('page');
    });

    it('should handle Japanese commands', () => {
      const intent = tracker.analyzeIntent('このページを要約して', []);
      expect(intent.action).toBe('summarize');
      expect(intent.target).toBe('page');
    });
  });

  describe('resolveReference', () => {
    it('should resolve page reference', () => {
      const context = {
        chatHistory: [],
        pageContext: {
          mainContent: 'This is the page content',
          metadata: { url: 'https://example.com', title: 'Test' }
        },
        memories: [],
        personas: [],
        activePersonaId: ''
      };

      const resolved = tracker.resolveReference('this page', context as any);
      expect(resolved.type).toBe('page');
      expect(resolved.resolved).toBe('This is the page content');
    });

    it('should resolve selection reference', () => {
      const context = {
        chatHistory: [],
        selection: 'Selected text here',
        memories: [],
        personas: [],
        activePersonaId: ''
      };

      const resolved = tracker.resolveReference('the selection', context as any);
      expect(resolved.type).toBe('selection');
      expect(resolved.resolved).toBe('Selected text here');
    });

    it('should resolve previous message reference', () => {
      const context = {
        chatHistory: [
          { id: '1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
          { id: '2', role: 'assistant' as const, content: 'This is a detailed response about the topic.', timestamp: Date.now() }
        ],
        memories: [],
        personas: [],
        activePersonaId: ''
      };

      const resolved = tracker.resolveReference('that', context as any);
      expect(resolved.type).toBe('previous_message');
    });
  });

  describe('isStopCommand', () => {
    it('should detect stop commands', () => {
      expect(tracker.isStopCommand('stop')).toBe(true);
      expect(tracker.isStopCommand('cancel this')).toBe(true);
      expect(tracker.isStopCommand('abort')).toBe(true);
      expect(tracker.isStopCommand('停止')).toBe(true);
      expect(tracker.isStopCommand('取消')).toBe(true);
    });

    it('should not detect non-stop commands', () => {
      expect(tracker.isStopCommand('continue')).toBe(false);
      expect(tracker.isStopCommand('summarize')).toBe(false);
    });
  });

  describe('isConfirmation', () => {
    it('should detect confirmations', () => {
      expect(tracker.isConfirmation('yes')).toBe(true);
      expect(tracker.isConfirmation('ok')).toBe(true);
      expect(tracker.isConfirmation('sure')).toBe(true);
      expect(tracker.isConfirmation('好')).toBe(true);
      expect(tracker.isConfirmation('是')).toBe(true);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property: Intent Confidence Range**
     * *For any* analyzed intent, confidence should be between 0 and 1
     */
    it('confidence should always be between 0 and 1', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          const intent = tracker.analyzeIntent(message, []);
          return intent.confidence >= 0 && intent.confidence <= 1;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Intent Type Validity**
     * *For any* analyzed intent, type should be one of the valid types
     */
    it('intent type should always be valid', () => {
      const validTypes = ['query', 'command', 'clarification', 'confirmation', 'chat'];
      
      fc.assert(
        fc.property(fc.string(), (message) => {
          const intent = tracker.analyzeIntent(message, []);
          return validTypes.includes(intent.type);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Action Keywords Detection**
     * *For any* message containing action keywords, the action should be detected
     */
    it('should detect action when keywords are present', () => {
      const actionKeywords = [
        { keyword: 'summarize', action: 'summarize' },
        { keyword: 'extract', action: 'extract' },
        { keyword: 'reply', action: 'reply' },
        { keyword: 'translate', action: 'translate' },
        { keyword: 'search', action: 'search' }
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...actionKeywords),
          fc.string(),
          ({ keyword, action }, suffix) => {
            const message = `${keyword} ${suffix}`;
            const intent = tracker.analyzeIntent(message, []);
            return intent.action === action;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
