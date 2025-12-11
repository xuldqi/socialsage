import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Persona, SocialPost, AutoRule, AiModelId, ContentBlueprint, AgentResponse, PageData, PromptTemplate, MemoryItem, SemanticElement, AgentAction, ChatMessage } from "../types";

// --- SYSTEM CONFIGURATION (FOR RELEASE) ---

/**
 * 🔑 SYSTEM API KEYS POOL (BACKEND / FALLBACK KEYS)
 * 
 * INSTRUCTIONS FOR RELEASE:
 * 1. Add your Google Gemini API Keys in the array below.
 * 2. You can add multiple keys. The system will randomly select one to distribute load.
 * 3. These keys are used when the user has NOT provided their own "Custom API Key" in settings.
 * 
 * ⚠️ NOTE: For production, remove hardcoded keys and require users to input their own.
 */
const SYSTEM_API_KEYS: string[] = [
  // 系统 API Key 已移除，用户必须在设置中输入自己的 API Key
].filter(k => !!k && k !== 'PLACEHOLDER_API_KEY') as string[];

const DAILY_LIMIT = 10; // 每日限制 10 次
const STORAGE_KEY = 'socialsage_daily_quota';

// 服务端配额 API（Cloudflare Worker）
// 部署后更新为实际的 Worker URL
const QUOTA_API_URL = ''; // 例如: 'https://socialsage-quota-api.your-subdomain.workers.dev'

// Localized Error Messages for Quota
const QUOTA_MESSAGES: Record<string, string> = {
  en: "Today's free quota is used up (10/day). To continue, please add your own API Key in Settings.",
  zh: "今日免费额度已用完（每日10次）。如需继续使用，请在设置内添加您的 API Key。",
  ja: "本日の無料枠（1日10回）を使い切りました。継続して使用するには、設定でAPIキーを追加してください。"
};

// Error messages for no API key
const NO_API_KEY_MESSAGES: Record<string, string> = {
  en: "⚠️ No API Key configured. Please go to Settings and enter your Gemini API Key.",
  zh: "⚠️ 未配置 API Key。请进入设置页面输入您的 Gemini API Key。",
  ja: "⚠️ APIキーが設定されていません。設定画面でGemini APIキーを入力してください。"
};

export interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  customModel?: string;
  signal?: AbortSignal;
  outputLanguage?: string; // 'en' | 'zh' | 'ja' etc.
}

// --- QUOTA MANAGEMENT ---

/**
 * 服务端配额检查（优先使用）
 */
const checkServerQuota = async (): Promise<{ allowed: boolean; remaining: number } | null> => {
  if (!QUOTA_API_URL) return null; // 未配置服务端 API，使用本地方案

  try {
    const response = await fetch(`${QUOTA_API_URL}/check-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('[Quota] Server check failed, falling back to local:', error);
    return null;
  }
};

/**
 * 服务端使用配额
 */
const useServerQuota = async (): Promise<boolean> => {
  if (!QUOTA_API_URL) return true; // 未配置服务端 API，使用本地方案

  try {
    const response = await fetch(`${QUOTA_API_URL}/use-quota`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const data = await response.json();
      return data.success !== false;
    }
    return true;
  } catch (error) {
    console.warn('[Quota] Server use failed:', error);
    return true; // 失败时允许使用，避免阻塞用户
  }
};

const checkDailyQuota = async (): Promise<boolean> => {
  // 尝试使用服务端检查
  const serverResult = await checkServerQuota();
  if (serverResult !== null) {
    return serverResult.allowed;
  }

  // 回退到本地 localStorage 检查
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return true;

    const { date, count } = JSON.parse(data);
    const today = new Date().toDateString();

    if (date !== today) {
      // Reset for new day
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: 0 }));
      return true;
    }

    return count < DAILY_LIMIT;
  } catch (e) {
    return true; // Fallback to allow if error
  }
};

const incrementDailyQuota = async () => {
  // 尝试使用服务端
  await useServerQuota();

  // 同时更新本地存储
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const today = new Date().toDateString();
    let count = 0;

    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.date === today) {
        count = parsed.count;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: count + 1 }));
  } catch (e) {
    console.error("Failed to update quota", e);
  }
};

export const getRemainingQuota = async (): Promise<number> => {
  // 尝试使用服务端
  const serverResult = await checkServerQuota();
  if (serverResult !== null) {
    return serverResult.remaining;
  }

  // 回退到本地
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return DAILY_LIMIT;
    const { date, count } = JSON.parse(data);
    if (date !== new Date().toDateString()) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - count);
  } catch (e) {
    return DAILY_LIMIT;
  }
};

// --- CLIENT FACTORY ---

/**
 * Gets a System Key using simple rotation/random selection to distribute load.
 */
const getSystemKey = (): string | null => {
  if (SYSTEM_API_KEYS.length === 0) {
    return null; // 没有系统 key，需要用户提供
  }
  // Simple random selection for load balancing
  const randomIndex = Math.floor(Math.random() * SYSTEM_API_KEYS.length);
  return SYSTEM_API_KEYS[randomIndex];
};

const getAiClient = (config?: AIConfig) => {
  // Priority: 1. User Custom Key -> 2. System Key Pool
  let apiKey = config?.apiKey;

  // If no user key, try to use System Key
  if (!apiKey) {
    const systemKey = getSystemKey();
    if (systemKey) {
      if (!checkDailyQuota()) {
        throw new Error("QUOTA_EXCEEDED");
      }
      apiKey = systemKey;
    }
  }

  if (!apiKey) {
    // 没有 API Key，抛出清晰的错误
    const lang = config?.outputLanguage || 'en';
    throw new Error(NO_API_KEY_MESSAGES[lang] || NO_API_KEY_MESSAGES.en);
  }
  return new GoogleGenAI({ apiKey });
};

const trackUsageIfDefault = (config?: AIConfig) => {
  // If no custom key is provided, we assume default key is used, so we increment quota
  if (!config?.apiKey) {
    incrementDailyQuota();
  }
};

const getLanguageInstruction = (config?: AIConfig): string => {
  if (!config || !config.outputLanguage || config.outputLanguage === 'en') return '';

  const langMap: Record<string, string> = {
    'zh': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German'
  };

  const target = langMap[config.outputLanguage] || config.outputLanguage;
  return `\nIMPORTANT: You MUST respond in ${target}.`;
};

// --- HUMAN TOUCH GUIDELINES ---
const HUMAN_TOUCH_GUIDELINES = `
CRITICAL STYLE GUIDELINES (ANTI-AI):
1. NO STRUCTURAL TEMPLATES: Do not use "Firstly", "Secondly", "In conclusion", "To summarize". Just say what you mean.
2. NO BUZZWORDS: Avoid "Underlying logic", "Methodology", "Paradigm shift". Use simple words like "Habit", "Way of thinking".
3. COLLOQUIAL: Use short sentences. Fragments are okay. Use softening words like "Feels like", "Probably", "Kinda".
4. NO FAKE EXPERIENCE: Do not invent a backstory. Do not say "I run a blog" unless it is in the provided memory.
5. BE CONCISE: If one sentence works, don't use two.
`;

// --- HELPER FOR ROBUST JSON PARSING ---
const cleanAndParseJson = (text: string): any => {
  let cleanText = text.trim();
  // Remove markdown code blocks if present
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '');
  }
  return JSON.parse(cleanText);
};

const callOpenAICompatible = async (
  systemPrompt: string,
  userPrompt: string,
  config?: AIConfig,
  jsonMode: boolean = false
): Promise<string> => {
  const apiKey = config?.apiKey || '';
  const baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
  const model = config?.customModel || 'gpt-3.5-turbo';

  let endpoint = baseUrl;
  if (!endpoint.includes('/chat/completions') && !endpoint.includes('/completions')) {
    endpoint = `${endpoint.replace(/\/$/, '')}/chat/completions`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: jsonMode ? { type: "json_object" } : undefined
      }),
      signal: config?.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom API Error: ${response.status} - ${errText.substring(0, 1000)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error("AI Service Error:", error);
    throw error;
  }
};

const handleApiError = (error: any, fallbackMessage: string = "Error generating AI response.", config?: AIConfig): string => {
  console.error("AI Service Error:", error);

  const errMsg = error instanceof Error ? error.message : String(error);

  // 1. Check for Quota Exceeded (Our internal error or Google's 429)
  if (errMsg.includes("QUOTA_EXCEEDED") || errMsg.includes("429")) {
    const lang = config?.outputLanguage === 'zh' ? 'zh' : config?.outputLanguage === 'ja' ? 'ja' : 'en';
    return `⚠️ ${QUOTA_MESSAGES[lang]}`;
  }

  // 2. Check for Missing System Keys
  if (errMsg.includes("NO_SYSTEM_KEYS_CONFIGURED")) {
    return "⚠️ System Misconfiguration: No API Keys available. Please set a custom key in settings.";
  }

  // 3. Provider Errors
  if (error && typeof error === 'object' && error.error && typeof error.error === 'object') {
    const inner = error.error;
    const code = inner.code || 'Unknown';
    const msg = inner.message || JSON.stringify(inner);
    if (msg.includes("Rpc failed") || msg.includes("xhr error")) {
      return "⚠️ Network Error: Unable to connect to AI Provider.";
    }
    return `⚠️ Provider Error (${code}): ${msg}`;
  }

  return fallbackMessage;
};

// --- CORE FUNCTIONS ---

export const generateReply = async (
  post: SocialPost,
  persona: Persona,
  customInstruction?: string,
  modelId: AiModelId = 'gemini-2.5-flash',
  memories: MemoryItem[] = [],
  config?: AIConfig
): Promise<string> => {
  try {
    // We only track quota if using system keys. We do this inside the try block 
    // to ensure checkDailyQuota() runs inside getAiClient().
    // However, if we want to fail fast before any logic, we can check.

    // Note: getAiClient checks quota. trackUsageIfDefault increments it.
    // We must track usage ONLY after a successful call or attempted call to prevent free usage loop hole?
    // Actually, simple count on attempt is safer to prevent abuse.
    if (!config?.apiKey) trackUsageIfDefault(config);

    const relevantMemories = memories.slice(0, 5).map(m => `- ${m.content}`).join('\n');
    const memoryContext = relevantMemories ? `\n\nUSER KNOWLEDGE:\n${relevantMemories}\nUse this context implicitly.` : '';

    const systemInstruction = `You are a social media pro.
    
    TARGET PERSONA:
    Tone: ${persona.tone}
    Style Sample: "${persona.exampleText}"
    ${memoryContext}
    
    ${HUMAN_TOUCH_GUIDELINES}
    
    INSTRUCTIONS:
    - Mimic the persona's style strictly.
    - Keep it concise and relevant to ${post.platform}.
    ${customInstruction ? `User Note: ${customInstruction}` : ''}
    ${getLanguageInstruction(config)}
    `;

    const prompt = `Reply to this post by ${post.author}:\n"${post.content}"`;

    if (modelId === 'custom' || modelId.startsWith('deepseek')) {
      return await callOpenAICompatible(systemInstruction, prompt, config);
    }

    const ai = getAiClient(config);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.85,
      }
    });

    return response.text || "";
  } catch (error) {
    return handleApiError(error, "Error generating reply.", config);
  }
};

export const polishContent = async (
  content: string,
  persona: Persona,
  goal: 'expand' | 'shorten' | 'polish' | 'translate',
  modelId: AiModelId = 'gemini-2.5-flash',
  config?: AIConfig
): Promise<string> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);

    let goalInstruction = "";
    switch (goal) {
      case 'expand': goalInstruction = "Expand the text with more detail."; break;
      case 'shorten': goalInstruction = "Condense the text."; break;
      case 'polish': goalInstruction = "Improve grammar and flow, making it sound native and matching the persona's tone."; break;
      case 'translate': goalInstruction = "Translate to the target language (implied by context or settings)."; break;
    }

    const systemInstruction = `You are an expert editor.
    Adopt this tone: ${persona.tone} (${persona.name}).
    Reference Style: "${persona.exampleText}"
    
    Task: ${goalInstruction}
    ${HUMAN_TOUCH_GUIDELINES}
    ${getLanguageInstruction(config)}
    `;

    if (modelId === 'custom' || modelId.startsWith('deepseek')) {
      return await callOpenAICompatible(systemInstruction, content, config);
    }

    const ai = getAiClient(config);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: content,
      config: { systemInstruction }
    });
    return response.text || "";
  } catch (error) {
    return handleApiError(error, "Error polishing content.", config);
  }
};

export const generateBlueprintContent = async (
  blueprint: ContentBlueprint,
  persona: Persona,
  modelId: AiModelId = 'gemini-2.5-flash',
  config?: AIConfig,
  language?: string
): Promise<string> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);

    const langInstruction = `Output Language: ${language === 'zh' ? 'Chinese (Simplified)' : language === 'ja' ? 'Japanese' : 'English'}`;

    const systemInstruction = `You are a creative social media writer.
    Persona: ${persona.name} (${persona.tone}).
    Style: "${persona.exampleText}"
    
    Goal: Write a ${blueprint.platform} ${blueprint.type} about ${blueprint.topics.join(', ')}.
    Audience: ${blueprint.audience}.
    Engagement Goal: ${blueprint.engagementGoal}.
    
    ${HUMAN_TOUCH_GUIDELINES}
    ${langInstruction}
    `;

    const prompt = blueprint.sourceMaterial
      ? `Rewrite this source material based on the persona:\n"${blueprint.sourceMaterial}"`
      : `Create original content for the topic: ${blueprint.name}`;

    if (modelId === 'custom' || modelId.startsWith('deepseek')) {
      return await callOpenAICompatible(systemInstruction, prompt, config);
    }

    const ai = getAiClient(config);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { systemInstruction, temperature: 0.9 }
    });
    return response.text || "";
  } catch (error) {
    return handleApiError(error, "Error generating content.", config);
  }
};

// --- STREAMING SUPPORT ---

export const processUserIntentStream = async (
  userMessage: string,
  currentPersonas: Persona[],
  currentRules: AutoRule[],
  modelId: AiModelId = 'gemini-2.5-flash',
  config?: AIConfig,
  pageContext?: { type?: string, url?: string, hasSelection?: boolean },
  chatHistory: ChatMessage[] = [],
  onChunk?: (chunk: string) => void
): Promise<AgentResponse> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);

    const systemInstruction = `You are SocialSage, a friendly, versatile, and intelligent AI assistant integrated into a browser extension.

    CORE IDENTITY:
    - You are helpful, polite, and conversational - like a real person helping a friend.
    - You can chat about ANYTHING (tech, life, cooking, coding).
    - You have special capabilities to control the "SocialSage" extension, but you ONLY use them if explicitly asked.
    - TERMINOLOGY: Use "Auto-Reply" (not Auto-Pilot).
    - SPEAK NATURALLY: Be conversational, use casual language, show empathy, and be genuinely helpful.

    CRITICAL BEHAVIORAL RULES:
    1. NO TECHNICAL JARGON: Never say "I have generated a JSON operation", "Config updated", or list rule IDs. Speak like a human.
    2. CHAT FIRST: If the user says "Hello", "How are you", or asks a question, JUST REPLY NORMALLY like a friend. Do NOT create rules or configs unless explicitly asked.
    3. SEMANTIC INTENT: Distinguish between "Task" (e.g., "Rewrite this text") and "Config" (e.g., "Always reply to tech posts").
        - If user gives text to improve -> Just output the improved text in 'responseMessage', naturally.
        - If user asks to setup automation -> ONLY THEN generate 'create_rule' operations.
    4. ONBOARDING: If this is the FIRST message in history, be welcoming and friendly. Ask "How can I help you today?" instead of forcing a setup checklist.
    5. HUMAN-LIKE RESPONSES: 
        - Write as if you're a real person having a conversation
        - Use natural language, avoid robotic phrases
        - Show understanding and empathy
        - Be concise but warm
        - Use appropriate emojis sparingly (especially for Chinese users)
        - Acknowledge what the user said before responding
    6. RESPONSE STYLE: 
        - Start with a brief acknowledgment when appropriate
        - Be direct and helpful
        - Avoid unnecessary formalities
        - Match the user's tone (casual if they're casual, professional if they're professional)

    AVAILABLE OPERATIONS (Only use if intent is explicit):
    - create_rule / update_rule / create_persona / update_persona
    - trigger_action (extract_data, summarize_page, translate_selection, delete_reply)
    - start_auto_pilot (Only if user says "Start Auto-Reply" or confirms settings)

    DELETE REPLY DETECTION:
    - If user mentions deleting a reply, comment, or mentions a specific author/reply content
    - Examples: "删除给张三的回复", "那条评论不好", "删掉关于XX的那条", "delete my reply to John"
    - Return trigger_action with action: 'delete_reply' and payload: { targetAuthor, targetContent, or replyId }

    CURRENT STATE:
    - Context: ${JSON.stringify(pageContext || {})}
    
    ${getLanguageInstruction(config)}
    `;

    // --- ONBOARDING GUARD ---
    const isFirstMessage = chatHistory.length === 0;
    const isGreeting = /^(hello|hi|hey|你好|您好|hi there)/i.test(userMessage.trim());
    if (isFirstMessage && isGreeting) {
      const greetingMsg = config?.outputLanguage === 'zh'
        ? "您好！我是您的全能社交助手。我可以帮您自动回复消息、润色文案、或者提取网页数据。今天想先试哪一个？"
        : "Hello! I'm your SocialSage assistant. I can help with auto-replies, drafting, or data extraction. What would you like to do first?";

      if (onChunk) {
        // Simulate streaming for greeting
        for (let i = 0; i < greetingMsg.length; i++) {
          onChunk(greetingMsg[i]);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      return {
        reasoning: "User greeted. Replying conversationally.",
        operations: [],
        responseMessage: greetingMsg,
        suggestions: []
      };
    }

    const conversationContext = chatHistory
      .filter(m => m.role !== 'system')
      .slice(-10)
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const finalPrompt = conversationContext
      ? `CHAT HISTORY:\n${conversationContext}\n\nUSER:\n${userMessage}`
      : userMessage;

    // For streaming, we'll get the full response first, then stream it
    // This is because JSON mode doesn't support streaming well
    if (modelId === 'custom' || modelId.startsWith('deepseek')) {
      const jsonStr = await callOpenAICompatible(systemInstruction, finalPrompt, config, true);
      const result = cleanAndParseJson(jsonStr);
      if (onChunk && result.responseMessage) {
        // Stream the response message
        for (let i = 0; i < result.responseMessage.length; i++) {
          onChunk(result.responseMessage[i]);
          await new Promise(resolve => setTimeout(resolve, 15));
        }
      }
      return result;
    }

    const ai = getAiClient(config);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: finalPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            operations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['create_rule', 'update_rule', 'create_persona', 'update_persona', 'trigger_action', 'update_session', 'start_auto_pilot'] },
                  payload: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, nullable: true },
                      description: { type: Type.STRING, nullable: true },
                      tone: { type: Type.STRING, nullable: true },
                      exampleText: { type: Type.STRING, nullable: true },
                      minLikes: { type: Type.NUMBER, nullable: true },
                      keywords: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                      actionType: { type: Type.STRING, nullable: true },
                      action: { type: Type.STRING, nullable: true },
                      maxReplies: { type: Type.NUMBER, nullable: true },
                      customInstruction: { type: Type.STRING, nullable: true }
                    },
                    nullable: true
                  }
                }
              }
            },
            responseMessage: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    const result = cleanAndParseJson(text);

    // Stream the response message character by character
    if (onChunk && result.responseMessage) {
      for (let i = 0; i < result.responseMessage.length; i++) {
        if (config?.signal?.aborted) break;
        onChunk(result.responseMessage[i]);
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }

    return result;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw e;
    }
    const errMsg = handleApiError(e, "Error processing intent.", config);
    return {
      reasoning: "Error encountered.",
      operations: [],
      responseMessage: errMsg.includes("QUOTA") ? errMsg : `(System) ${errMsg} - I might be having trouble connected to the AI.`,
      suggestions: []
    };
  }
};

export const processUserIntent = async (
  userMessage: string,
  currentPersonas: Persona[],
  currentRules: AutoRule[],
  modelId: AiModelId = 'gemini-2.5-flash',
  config?: AIConfig,
  pageContext?: { type?: string, url?: string, hasSelection?: boolean },
  chatHistory: ChatMessage[] = []
): Promise<AgentResponse> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);

    const systemInstruction = `You are SocialSage, a friendly, versatile, and intelligent AI assistant integrated into a browser extension.

    CORE IDENTITY:
    - You are helpful, polite, and conversational - like a real person helping a friend.
    - You can chat about ANYTHING (tech, life, cooking, coding).
    - You have special capabilities to control the "SocialSage" extension, but you ONLY use them if explicitly asked.
    - TERMINOLOGY: Use "Auto-Reply" (not Auto-Pilot).
    - SPEAK NATURALLY: Be conversational, use casual language, show empathy, and be genuinely helpful.

    CRITICAL BEHAVIORAL RULES:
    1. NO TECHNICAL JARGON: Never say "I have generated a JSON operation", "Config updated", or list rule IDs. Speak like a human.
    2. CHAT FIRST: If the user says "Hello", "How are you", or asks a question, JUST REPLY NORMALLY like a friend. Do NOT create rules or configs unless explicitly asked.
    3. SEMANTIC INTENT: Distinguish between "Task" (e.g., "Rewrite this text") and "Config" (e.g., "Always reply to tech posts").
        - If user gives text to improve -> Just output the improved text in 'responseMessage', naturally.
        - If user asks to setup automation -> ONLY THEN generate 'create_rule' operations.
    4. ONBOARDING: If this is the FIRST message in history, be welcoming and friendly. Ask "How can I help you today?" instead of forcing a setup checklist.
    5. HUMAN-LIKE RESPONSES: 
        - Write as if you're a real person having a conversation
        - Use natural language, avoid robotic phrases
        - Show understanding and empathy
        - Be concise but warm
        - Use appropriate emojis sparingly (especially for Chinese users)
        - Acknowledge what the user said before responding
    6. RESPONSE STYLE: 
        - Start with a brief acknowledgment when appropriate
        - Be direct and helpful
        - Avoid unnecessary formalities
        - Match the user's tone (casual if they're casual, professional if they're professional)

    AVAILABLE OPERATIONS (Only use if intent is explicit):
    - create_rule / update_rule / create_persona / update_persona
    - trigger_action (extract_data, summarize_page, translate_selection, delete_reply)
    - start_auto_pilot (Only if user says "Start Auto-Reply" or confirms settings)

    DELETE REPLY DETECTION:
    - If user mentions deleting a reply, comment, or mentions a specific author/reply content
    - Examples: "删除给张三的回复", "那条评论不好", "删掉关于XX的那条", "delete my reply to John"
    - Return trigger_action with action: 'delete_reply' and payload: { targetAuthor, targetContent, or replyId }

    CURRENT STATE:
    - Context: ${JSON.stringify(pageContext || {})}
    
    ${getLanguageInstruction(config)}
    `;

    // --- ONBOARDING GUARD ---
    const isFirstMessage = chatHistory.length === 0;
    const isGreeting = /^(hello|hi|hey|你好|您好|hi there)/i.test(userMessage.trim());
    if (isFirstMessage && isGreeting) {
      return {
        reasoning: "User greeted. Replying conversationally.",
        operations: [],
        responseMessage: config?.outputLanguage === 'zh' ? "您好！我是您的全能社交助手。我可以帮您自动回复消息、润色文案、或者提取网页数据。今天想先试哪一个？" : "Hello! I'm your SocialSage assistant. I can help with auto-replies, drafting, or data extraction. What would you like to do first?",
        suggestions: []
      };
    }

    const conversationContext = chatHistory
      .filter(m => m.role !== 'system')
      .slice(-10) // Keep last 10 turns for context
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const finalPrompt = conversationContext
      ? `CHAT HISTORY:\n${conversationContext}\n\nUSER:\n${userMessage}`
      : userMessage;

    if (modelId === 'custom' || modelId.startsWith('deepseek')) {
      const jsonStr = await callOpenAICompatible(systemInstruction, finalPrompt, config, true);
      return cleanAndParseJson(jsonStr);
    }

    const ai = getAiClient(config);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: finalPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            operations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['create_rule', 'update_rule', 'create_persona', 'update_persona', 'trigger_action', 'update_session', 'start_auto_pilot'] },
                  payload: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, nullable: true },
                      description: { type: Type.STRING, nullable: true },
                      tone: { type: Type.STRING, nullable: true },
                      exampleText: { type: Type.STRING, nullable: true },
                      minLikes: { type: Type.NUMBER, nullable: true },
                      keywords: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                      actionType: { type: Type.STRING, nullable: true },
                      action: { type: Type.STRING, nullable: true },
                      maxReplies: { type: Type.NUMBER, nullable: true },
                      customInstruction: { type: Type.STRING, nullable: true }
                    },
                    nullable: true
                  }
                }
              }
            },
            responseMessage: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return cleanAndParseJson(text);
  } catch (e) {
    const errMsg = handleApiError(e, "Error processing intent.", config);
    return {
      reasoning: "Error encountered.",
      operations: [],
      responseMessage: errMsg.includes("QUOTA") ? errMsg : `(System) ${errMsg} - I might be having trouble connected to the AI.`,
      suggestions: []
    };
  }
};

// --- EXTRACTION / ANALYSIS TOOLS ---

export const analyzeProfileStyle = async (content: string, modelId: AiModelId, config?: AIConfig) => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    const sys = `Analyze this social media profile. Return JSON: { name, description, tone, exampleText }. ${HUMAN_TOUCH_GUIDELINES}`;
    if (modelId === 'custom' || modelId.startsWith('deepseek')) return cleanAndParseJson(await callOpenAICompatible(sys, content, config, true));
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({
      model: modelId, contents: content,
      config: { systemInstruction: sys, responseMimeType: "application/json" }
    });
    return cleanAndParseJson(res.text || "{}");
  } catch (e) { console.error(e); return {}; }
};

export const analyzePostStyle = async (author: string, content: string, modelId: AiModelId, config?: AIConfig) => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    const sys = `Analyze post style. Return JSON: { name: "${author}'s Style", description, tone, exampleText }. ${HUMAN_TOUCH_GUIDELINES}`;
    if (modelId === 'custom' || modelId.startsWith('deepseek')) return cleanAndParseJson(await callOpenAICompatible(sys, content, config, true));
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({
      model: modelId, contents: content,
      config: { systemInstruction: sys, responseMimeType: "application/json" }
    });
    return cleanAndParseJson(res.text || "{}");
  } catch (e) { console.error(e); return {}; }
};

export const extractStructuredData = async (content: string, modelId: AiModelId, config?: AIConfig) => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    const sys = "Extract key data as JSON Array. Example: [{name: '...', value: '...'}].";
    if (modelId === 'custom' || modelId.startsWith('deepseek')) return await callOpenAICompatible(sys, content, config, true);
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({
      model: modelId, contents: content,
      config: { systemInstruction: sys, responseMimeType: "application/json" }
    });
    return res.text || "[]";
  } catch (e) { return "[]"; }
};

export const summarizeVideoContent = async (content: string, modelId: AiModelId, config?: AIConfig) => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    const sys = "Summarize this video transcript with timestamps.";
    if (modelId === 'custom' || modelId.startsWith('deepseek')) return await callOpenAICompatible(sys, content, config);
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({ model: modelId, contents: content, config: { systemInstruction: sys } });
    return res.text || "";
  } catch (e) { return "Error summarizing."; }
};

export const explainSelection = async (text: string, mode: 'explain' | 'translate', modelId: AiModelId, config?: AIConfig) => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    let prompt = `Explain: "${text}"`;
    if (mode === 'translate') {
      prompt = `Translate to ${config?.outputLanguage === 'zh' ? 'Chinese' : 'English'}: "${text}"`;
    } else {
      // Localize explanation request
      if (config?.outputLanguage === 'zh') prompt = `解释这段文字: "${text}"`;
      else if (config?.outputLanguage === 'ja') prompt = `このテキストを説明してください: "${text}"`;
    }

    if (modelId === 'custom' || modelId.startsWith('deepseek')) return await callOpenAICompatible("Helpful Assistant", prompt, config);
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({ model: modelId, contents: prompt });
    return res.text || "";
  } catch (e) { return "Error processing."; }
};

export const chatWithPage = async (
  question: string,
  pageContent: string,
  modelId: AiModelId,
  config?: AIConfig,
  chatHistory?: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);

    const lang = config?.outputLanguage || 'en';
    const langInstruction = lang === 'zh' ? '请用中文回复。' : lang === 'ja' ? '日本語で回答してください。' : '';

    const systemPrompt = `You are SocialSage, a helpful AI assistant integrated into a browser extension.
You help users with social media tasks, content analysis, and general questions.

Current page context:
${pageContent}

${langInstruction}

Be helpful, concise, and conversational. If the user asks about the page, use the context provided.`;

    // 构建消息历史
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    if (chatHistory && chatHistory.length > 0) {
      messages.push(...chatHistory);
    }
    messages.push({ role: 'user', content: question });

    // 使用自定义API
    if ((modelId === 'custom' || modelId.startsWith('deepseek')) && config?.baseUrl) {
      const apiKey = config.apiKey || '';
      const baseUrl = config.baseUrl;
      const model = config.customModel || 'gpt-3.5-turbo';

      let endpoint = baseUrl;
      if (!endpoint.includes('/chat/completions')) {
        endpoint = `${endpoint.replace(/\/$/, '')}/chat/completions`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7
        }),
        signal: config.signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }

    // 使用 Gemini API
    const ai = getAiClient(config);

    // 构建 Gemini 格式的内容
    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const res = await ai.models.generateContent({
      model: modelId || 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7
      }
    });

    return res.text || '';

  } catch (e) {
    console.error('[chatWithPage] Error:', e);
    throw e;
  }
};

export const planPageInteraction = async (intent: string, elements: SemanticElement[], modelId: AiModelId, config?: AIConfig): Promise<AgentAction[]> => {
  try {
    if (!config?.apiKey) trackUsageIfDefault(config);
    const sys = `You are a Browser Agent. Map intent to actions (click, fill). Elements: ${JSON.stringify(elements)}. Return JSON Array of AgentAction.`;
    if (modelId === 'custom' || modelId.startsWith('deepseek')) return cleanAndParseJson(await callOpenAICompatible(sys, intent, config, true));
    const ai = getAiClient(config);
    const res = await ai.models.generateContent({
      model: modelId, contents: intent,
      config: { systemInstruction: sys, responseMimeType: "application/json" }
    });
    return cleanAndParseJson(res.text || "[]");
  } catch (e) { return []; }
};

export const testApiConnection = async (config: AIConfig): Promise<{ success: boolean; message?: string }> => {
  try {
    console.log('[API Test] Starting connection test...', {
      hasApiKey: !!config.apiKey,
      hasBaseUrl: !!config.baseUrl,
      baseUrl: config.baseUrl,
      model: config.customModel
    });

    // For custom/OpenAI compatible APIs (DeepSeek, etc.)
    if (config.baseUrl && config.apiKey) {
      console.log('[API Test] Testing OpenAI compatible endpoint:', config.baseUrl);
      const result = await callOpenAICompatible("Test", "Say 'OK'", config);
      console.log('[API Test] Success! Response:', result.substring(0, 50));
      return { success: true, message: "连接成功！" };
    }

    // For Gemini API
    if (config.apiKey && !config.baseUrl) {
      console.log('[API Test] Testing Gemini API');
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
      return { success: true, message: "连接成功！" };
    }

    // Fallback: If no custom key, test system key availability
    if (SYSTEM_API_KEYS.length > 0) {
      const sysKey = getSystemKey();
      if (sysKey) {
        const ai = new GoogleGenAI({ apiKey: sysKey });
        await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
        return { success: true, message: "使用系统密钥连接成功" };
      }
    }

    return { success: false, message: "请输入 API Key 和 Base URL" };
  } catch (e: any) {
    console.error('[API Test] Connection failed:', e);
    const errMsg = e instanceof Error ? e.message : String(e);

    // 提供更清晰的错误信息
    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
      return { success: false, message: "API Key 无效，请检查密钥是否正确" };
    }
    if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
      return { success: false, message: "无权访问，请检查 API Key 权限" };
    }
    if (errMsg.includes('404')) {
      return { success: false, message: "API 地址错误，请检查 Base URL" };
    }
    if (errMsg.includes('429')) {
      return { success: false, message: "请求过于频繁，请稍后再试" };
    }
    if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed to fetch')) {
      return { success: false, message: "网络连接失败，请检查网络或 Base URL" };
    }

    return { success: false, message: errMsg.substring(0, 100) };
  }
};