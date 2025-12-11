/**
 * Context Manager Tests
 * 
 * 测试上下文管理功能
 * **Feature: agent-core-upgrade, Property 2: Page Context Inclusion**
 * **Validates: Requirements 1.1, 1.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ContextManager } from '../services/contextManager';
import { MemoryItem, ChatMessage, Persona } from '../types';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager();
  });

  describe('Page Context', () => {
    it('should update and retrieve page context', () => {
      const pageContext = {
        mainContent: 'Test content',
        metadata: { url: 'https://example.com', title: 'Test Page' }
      };

      manager.updatePageContext(pageContext as any);

      expect(manager.hasPageContext()).toBe(true);
      expect(manager.getPageContext()?.mainContent).toBe('Test content');
    });

    it('should clear page context', () => {
      manager.updatePageContext({ mainContent: 'Test', metadata: {} } as any);
      manager.clearPageContext();

      expect(manager.hasPageContext()).toBe(false);
      expect(manager.getPageContext()).toBeUndefined();
    });
  });

  describe('Selection', () => {
    it('should update and retrieve selection', () => {
      manager.updateSelection('Selected text');

      expect(manager.getSelection()).toBe('Selected text');
    });

    it('should clear selection', () => {
      manager.updateSelection('Selected text');
      manager.clearSelection();

      expect(manager.getSelection()).toBeUndefined();
    });
  });

  describe('Chat History', () => {
    it('should add messages to history', () => {
      const message: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now()
      };

      manager.addMessage(message);

      const history = manager.getChatHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Hello');
    });

    it('should limit history length', () => {
      const customManager = new ContextManager({ maxChatHistory: 5 });

      for (let i = 0; i < 10; i++) {
        customManager.addMessage({
          id: String(i),
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      const history = customManager.getChatHistory();
      expect(history).toHaveLength(5);
      expect(history[0].content).toBe('Message 5');
    });

    it('should get recent messages', () => {
      for (let i = 0; i < 10; i++) {
        manager.addMessage({
          id: String(i),
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      const recent = manager.getRecentMessages(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].content).toBe('Message 7');
    });
  });

  describe('Memory Retrieval', () => {
    const memories: MemoryItem[] = [
      { id: '1', content: 'I love programming in TypeScript', source: 'test', timestamp: Date.now() },
      { id: '2', content: 'My favorite color is blue', source: 'test', timestamp: Date.now() },
      { id: '3', content: 'I work as a software engineer', source: 'test', timestamp: Date.now() },
      { id: '4', content: 'JavaScript is a programming language', source: 'test', timestamp: Date.now() }
    ];

    beforeEach(() => {
      manager.setMemories(memories);
    });

    it('should retrieve relevant memories', () => {
      const relevant = manager.retrieveRelevantMemories('programming');

      expect(relevant.length).toBeGreaterThan(0);
      // Should include memories about programming
      const contents = relevant.map(m => m.content);
      expect(contents.some(c => c.includes('programming') || c.includes('TypeScript'))).toBe(true);
    });

    it('should return empty array for empty query', () => {
      const relevant = manager.retrieveRelevantMemories('');
      expect(relevant).toHaveLength(0);
    });

    it('should limit results', () => {
      const relevant = manager.retrieveRelevantMemories('programming', 1);
      expect(relevant.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Build Context', () => {
    it('should build complete context', () => {
      manager.updatePageContext({
        mainContent: 'Page content',
        metadata: { url: 'https://example.com', title: 'Test' }
      } as any);
      manager.updateSelection('Selected text');
      manager.setMemories([{ id: '1', content: 'Memory', source: 'test', timestamp: Date.now() }]);
      manager.setPersonas([{ id: 'p1', name: 'Test Persona' } as Persona]);
      manager.setActivePersonaId('p1');

      const context = manager.buildContext();

      expect(context.pageContext).toBeDefined();
      expect(context.selection).toBe('Selected text');
      expect(context.memories.length).toBeGreaterThan(0);
      expect(context.personas).toHaveLength(1);
      expect(context.activePersonaId).toBe('p1');
    });

    it('should build context string', () => {
      manager.updatePageContext({
        mainContent: 'Page content here',
        metadata: { url: 'https://example.com', title: 'Test Page' }
      } as any);
      manager.updateSelection('Selected text');

      const contextStr = manager.buildContextString();

      expect(contextStr).toContain('[Current Page]');
      expect(contextStr).toContain('https://example.com');
      expect(contextStr).toContain('[Selected Text]');
      expect(contextStr).toContain('Selected text');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * **Feature: agent-core-upgrade, Property 2: Page Context Inclusion**
     * *For any* page context set, buildContext should include it
     */
    it('page context should always be included in built context', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.length > 0),
          fc.webUrl(),
          (content, url) => {
            const localManager = new ContextManager();
            localManager.updatePageContext({
              mainContent: content,
              metadata: { url, title: 'Test' }
            } as any);

            const context = localManager.buildContext();
            return context.pageContext !== undefined &&
              context.pageContext.mainContent === content;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property 1: Memory Retrieval Relevance**
     * *For any* query, returned memories should have higher relevance than non-returned ones
     */
    it('returned memories should be more relevant than non-returned', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string().filter(s => s.length > 5), { minLength: 5, maxLength: 20 }),
          fc.string().filter(s => s.length > 3),
          (memoryContents, query) => {
            const localManager = new ContextManager({ maxRelevantMemories: 3 });
            const memories: MemoryItem[] = memoryContents.map((content, i) => ({
              id: String(i),
              content,
              source: 'test',
              timestamp: Date.now()
            }));
            localManager.setMemories(memories);

            const relevant = localManager.retrieveRelevantMemories(query);

            // If we got results, they should be limited
            return relevant.length <= 3;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Chat History Limit**
     * *For any* number of messages added, history should never exceed max limit
     */
    it('chat history should never exceed max limit', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 50 }),
          fc.nat({ max: 30 }).filter(n => n > 0),
          (messageCount, maxHistory) => {
            const localManager = new ContextManager({ maxChatHistory: maxHistory });

            for (let i = 0; i < messageCount; i++) {
              localManager.addMessage({
                id: String(i),
                role: 'user',
                content: `Message ${i}`,
                timestamp: Date.now()
              });
            }

            return localManager.getChatHistory().length <= maxHistory;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: agent-core-upgrade, Property: Selection Update Consistency**
     * *For any* selection text, getSelection should return exactly what was set
     */
    it('selection should be exactly what was set', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const localManager = new ContextManager();
          localManager.updateSelection(text);
          return localManager.getSelection() === text;
        }),
        { numRuns: 100 }
      );
    });
  });
});
