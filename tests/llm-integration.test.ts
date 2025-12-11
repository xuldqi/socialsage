/**
 * LLM Integration Test
 * 
 * 测试真实 LLM API 调用
 * 运行: npx vitest run tests/llm-integration.test.ts
 */

import { describe, it, expect } from 'vitest';

// Gemini API Key for testing
const TEST_API_KEY = 'AIzaSyCj2BFFJV5MTY0q1UIi32vA1Y6dx2z_8RU';

describe('LLM Integration Tests', () => {
  describe('Gemini API Direct Call', () => {
    it('should call Gemini API successfully', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      
      const ai = new GoogleGenAI({ apiKey: TEST_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say "Hello, SocialSage!" in exactly 3 words.',
        config: {
          temperature: 0.1,
          maxOutputTokens: 50
        }
      });
      
      console.log('Gemini Response:', response.text);
      
      expect(response.text).toBeDefined();
      expect(response.text!.length).toBeGreaterThan(0);
    }, 30000); // 30 second timeout
  });

  describe('ToolLLMService', () => {
    it('should summarize content with LLM', async () => {
      const { summarizeWithLLM } = await import('../services/toolLLMService');
      
      const testContent = `
        Artificial intelligence (AI) is transforming how we work and live. 
        Machine learning algorithms can now recognize images, understand speech, 
        and even generate creative content. Companies are investing billions in AI research.
        The technology is expected to create new jobs while automating others.
        Ethical considerations around AI bias and privacy remain important challenges.
      `;
      
      const summary = await summarizeWithLLM(testContent, 100, {
        apiKey: TEST_API_KEY,
        model: 'gemini-2.5-flash',
        outputLanguage: 'en'
      });
      
      console.log('Summary:', summary);
      
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(20);
      expect(summary.length).toBeLessThan(500);
    }, 30000);

    it('should extract data with LLM', async () => {
      const { extractWithLLM } = await import('../services/toolLLMService');
      
      const testContent = `
        Contact us at support@example.com or sales@company.org.
        Call us at +1-555-123-4567 or visit https://www.example.com
        Our office is open Monday to Friday, 9am-5pm.
        Products start at $29.99 and premium plans are $99/month.
      `;
      
      const entities = await extractWithLLM(testContent, undefined, {
        apiKey: TEST_API_KEY,
        model: 'gemini-2.5-flash'
      });
      
      console.log('Extracted Entities:', JSON.stringify(entities, null, 2));
      
      expect(entities).toBeDefined();
      expect(Array.isArray(entities)).toBe(true);
      // Should find emails, phones, URLs, prices
      expect(entities.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate reply with LLM', async () => {
      const { generateReplyWithLLM } = await import('../services/toolLLMService');
      
      const reply = await generateReplyWithLLM(
        'Just launched my new startup! So excited to share this journey with everyone.',
        'TechFounder',
        { id: '1', name: 'Friendly', tone: 'Supportive and encouraging', description: '', exampleText: 'Great work!' },
        'support',
        [],
        {
          apiKey: TEST_API_KEY,
          model: 'gemini-2.5-flash',
          outputLanguage: 'en'
        }
      );
      
      console.log('Generated Reply:', reply);
      
      expect(reply).toBeDefined();
      expect(reply.length).toBeGreaterThan(10);
    }, 30000);
  });

  describe('Chinese Language Support', () => {
    it('should summarize in Chinese', async () => {
      const { summarizeWithLLM } = await import('../services/toolLLMService');
      
      const testContent = `
        人工智能正在改变我们的工作和生活方式。
        机器学习算法现在可以识别图像、理解语音，甚至生成创意内容。
        各大公司正在投入数十亿美元进行人工智能研究。
        这项技术预计将创造新的就业机会，同时也会自动化一些工作。
      `;
      
      const summary = await summarizeWithLLM(testContent, 100, {
        apiKey: TEST_API_KEY,
        model: 'gemini-2.5-flash',
        outputLanguage: 'zh'
      });
      
      console.log('Chinese Summary:', summary);
      
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(10);
    }, 30000);
  });
});
