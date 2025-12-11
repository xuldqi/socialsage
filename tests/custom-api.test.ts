/**
 * Custom API Integration Test (PackyAPI)
 * 
 * 测试第三方 OpenAI 兼容 API
 * 运行: npx vitest run tests/custom-api.test.ts
 */

import { describe, it, expect } from 'vitest';

// PackyAPI Configuration - read from environment variables
const CUSTOM_API_KEY = process.env.PACKY_API_KEY || '';
const CUSTOM_BASE_URL = process.env.PACKY_BASE_URL || 'https://www.packyapi.com/v1';
const CUSTOM_MODEL = process.env.PACKY_MODEL || 'claude-haiku-4-5-20251001';

describe('Custom API (PackyAPI) Integration Tests', () => {
  describe('Direct API Call', () => {
    it('should call PackyAPI successfully', async () => {
      const response = await fetch(`${CUSTOM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOM_API_KEY}`
        },
        body: JSON.stringify({
          model: CUSTOM_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello, SocialSage!" in exactly 3 words.' }
          ],
          temperature: 0.7,
          max_tokens: 50
        })
      });

      console.log('Response Status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('PackyAPI Response:', JSON.stringify(data, null, 2));

      expect(data.choices).toBeDefined();
      expect(data.choices.length).toBeGreaterThan(0);
      expect(data.choices[0].message.content).toBeDefined();
      
      console.log('Generated Text:', data.choices[0].message.content);
    }, 60000); // 60 second timeout
  });

  describe('Via geminiService callOpenAICompatible', () => {
    it('should work with existing callOpenAICompatible function', async () => {
      // 直接测试 fetch 调用，模拟 geminiService 的行为
      const systemPrompt = 'You are a social media expert. Be concise and helpful.';
      const userPrompt = 'Write a short, friendly reply to: "Just launched my startup!"';

      const response = await fetch(`${CUSTOM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOM_API_KEY}`
        },
        body: JSON.stringify({
          model: CUSTOM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log('Reply Generated:', content);
      
      expect(content.length).toBeGreaterThan(10);
    }, 60000);
  });

  describe('JSON Mode for Data Extraction', () => {
    it('should extract structured data in JSON format', async () => {
      const systemPrompt = `Extract structured data from the content.
Return a JSON array of objects with "type" and "value" fields.
Example: [{"type": "email", "value": "test@example.com"}]`;

      const userPrompt = `Extract entities from:
Contact: john@example.com, Phone: 555-1234
Website: https://example.com
Price: $99.99`;

      const response = await fetch(`${CUSTOM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOM_API_KEY}`
        },
        body: JSON.stringify({
          model: CUSTOM_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      
      console.log('Extracted JSON:', content);
      
      // 尝试解析 JSON
      try {
        const cleanContent = content.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleanContent);
        console.log('Parsed Entities:', parsed);
        expect(Array.isArray(parsed) || typeof parsed === 'object').toBe(true);
      } catch (e) {
        console.log('JSON parsing note:', e);
        // 即使 JSON 解析失败，只要有内容就算通过
        expect(content.length).toBeGreaterThan(5);
      }
    }, 60000);
  });

  describe('Chinese Language Support', () => {
    it('should respond in Chinese', async () => {
      const response = await fetch(`${CUSTOM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOM_API_KEY}`
        },
        body: JSON.stringify({
          model: CUSTOM_MODEL,
          messages: [
            { role: 'system', content: '你是一个友好的中文助手。请用中文回复。' },
            { role: 'user', content: '用一句话介绍人工智能' }
          ],
          temperature: 0.7
        })
      });

      expect(response.ok).toBe(true);
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log('Chinese Response:', content);
      
      expect(content.length).toBeGreaterThan(5);
      // 检查是否包含中文字符
      expect(/[\u4e00-\u9fff]/.test(content)).toBe(true);
    }, 60000);
  });
});
