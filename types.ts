

export enum Platform {
  X = 'X',
  Weibo = 'Weibo',
  Xiaohongshu = 'Xiaohongshu',
  Facebook = 'Facebook',
  YouTube = 'YouTube',
  Bilibili = 'Bilibili',
  Douyin = 'Douyin',
  TikTok = 'TikTok',
  Reddit = 'Reddit'
}

export type PageType = 'social' | 'article' | 'video' | 'product' | 'email' | 'profile';

export interface Persona {
  id: string;
  name: string;
  description: string;
  tone: string; // e.g., "Professional", "Sarcastic", "Cute/Gen-Z"
  exampleText: string;
}

export interface SocialPost {
  id: string;
  platform: Platform;
  author: string;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  timestamp: string;
  avatarUrl: string;
  replyDraft?: string;
  isAutoReplied?: boolean;
  isSkipped?: boolean;
  usedPersonaId?: string;
  isLiked?: boolean; // New: Track if we liked it
  reviewStatus?: 'pending' | 'approved' | 'rejected'; // New: For Semi-Auto Mode
}

// Reply History - Track all sent replies for deletion
export interface ReplyHistory {
  id: string;
  postId: string; // Original post ID
  platform: Platform;
  originalAuthor: string; // Who we replied to
  originalContent: string; // Original post content
  replyContent: string; // What we replied
  timestamp: number; // When we sent it
  url?: string; // URL where the reply was sent
  elementSelector?: string; // CSS selector to find the reply element for deletion
  personaId?: string; // Which persona was used
}

export interface AutoRule {
  id: string;
  name: string;
  minLikes: number;
  minComments?: number;
  targetCategory?: string;
  platform?: Platform;
  keywords: string[];
  actionPersonaId: string;
  isActive: boolean;
  actionType: 'reply' | 'skip';
  performLike?: boolean; // New: Strategy to like before replying
  customInstruction?: string;
}

export interface ContentBlueprint {
  id: string;
  name: string;
  type: 'post' | 'reply';
  category: 'informational' | 'promotional' | 'personal' | 'question' | 'debate';
  audience: string;
  topics: string[];
  engagementGoal: 'visibility' | 'discussion' | 'saves' | 'conversion';
  platform: Platform;
  personaIds: string[];
  sourceMaterial?: string;
}

// Memory / Knowledge Base Types
export interface MemoryItem {
  id: string;
  content: string;
  source: string; // URL or "Manual"
  timestamp: number;
  tags?: string[];
}

// --- NEW: Industrial Grade Extraction Types (REAL) ---

export interface DomNodeSummary {
  nodeId: string; // generated ID or real ID
  tag: string;
  classes?: string[];
  text?: string;
  role?: string; // ARIA role
  children?: DomNodeSummary[];
  attributes?: Record<string, string>;
  isInteractive?: boolean;
  rect?: { width: number, height: number, top: number, left: number }; // Visual geometry
}

export interface PageMetadata {
  url: string;
  title: string;
  description?: string;
  language?: string;
  canonicalUrl?: string;
  viewport?: { width: number, height: number };
}

export interface PageState {
  scrollY: number;
  docHeight: number;
  hasPagination: boolean;
  interactiveModalOpen: boolean;
}

export interface CapturedContext {
  metadata: PageMetadata;
  mainContent: string; // Cleaned text
  domTree: DomNodeSummary[]; // Compressed DOM for AI
  userFocus?: {
    selectionText?: string;
    hoverNodeId?: string;
  };
  state: PageState;
  timestamp: number;
}

export interface ExtractOptions {
  rootElement?: HTMLElement; // Optional root to scope extraction (for Simulator)
  maxDepth?: number;
  includeRects?: boolean;
}

// Extension & Agent Types

export type ExtensionTab = 'context' | 'chat' | 'settings' | 'logs' | 'memory' | 'rules' | 'personas' | 'drafts' | 'stats' | 'queue';

export interface PageData {
  type: PageType;
  url: string;
  title: string;
  content: string; // Plain text or Transcript
  metadata?: any; // Extra data like video length, product prices
}

// --- Semantic Agent Types (The Eye of the AI) ---
export interface SemanticElement {
  id: number;
  role: 'button' | 'input' | 'textarea' | 'link' | 'text';
  label?: string; // e.g. "Submit", "Search"
  value?: string; // Current value
  placeholder?: string;
}

export interface AgentAction {
  type: 'click' | 'fill' | 'navigate';
  targetId?: number; // The ID from SemanticElement
  value?: string; // Text to type
  description: string; // "Clicking the submit button"
}

export type AutoPilotStatus = 'idle' | 'scanning' | 'analyzing' | 'writing' | 'skipping' | 'replying_done' | 'liking' | 'review_wait';

export interface ExtensionContext {
  status: 'idle' | 'reading' | 'replying' | 'posting' | 'analyzing' | 'executing';
  autoPilotStatus?: AutoPilotStatus; // Granular status for the autonomous loop
  agentThinking?: string; // UPDATED: Granular thought process text (e.g. "Checking keywords...")

  // NEW: Rich Context from "Content Script"
  capturedContext?: CapturedContext;

  pageData?: PageData;
  selection?: string; // Currently selected text on the page
  postData?: SocialPost; // Specific post context if on social
  analyzedPersona?: Partial<Persona>; // Temporary storage for profile analysis

  // Real-time Sync State
  draftContent?: string; // The text currently in the browser's input box
  immediateIntent?: { action: string; timestamp: number };

  // The AI's view of the current page structure
  visibleElements?: SemanticElement[];

  isAutoSessionActive?: boolean;
  sessionPlan?: string[];

  // Session Stats Tracking
  sessionStats?: {
    repliesCount: number;
    startTime: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system'; // Added 'system' for logs
  content: string;
  timestamp: number;
  reasoning?: string; // AI's internal thought process
  suggestions?: string[]; // AI's follow-up suggestions
}

export type AiProvider = 'google' | 'custom';

export type AiModelId = 'gemini-2.5-flash' | 'gemini-3-pro-preview' | string;

export interface UserSettings {
  apiKey: string;
  provider: AiProvider;
  selectedModel: AiModelId;
  customBaseUrl?: string;
  customApiKey?: string;
  customModelName?: string;
  autoDetect: boolean;
  autoPilotSpeed: 'fast' | 'human' | 'slow';
  autoReplyMode: 'automatic' | 'review'; // New: Semi-Auto Support
  language: 'en' | 'zh' | 'ja';
  outputLanguage?: string;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  source: 'User' | 'AI Agent' | 'Auto-Pilot' | 'System';
}

// Agent Operation Types

export type SystemOperationType = 'create_rule' | 'update_rule' | 'delete_rule' | 'create_persona' | 'update_persona' | 'trigger_action' | 'update_session' | 'start_auto_pilot';

export interface SystemOperation {
  type: SystemOperationType;
  payload: any; // Dynamic payload based on type (e.g. { action: 'extract_data' })
}

export interface AgentResponse {
  reasoning: string;
  operations: SystemOperation[];
  responseMessage: string;
  suggestions: string[];
}

// --- New Types for Output/Architecture ---

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userInputTemplate: string; // Use {{context}} placeholder
  icon?: string;
}

export interface ExtensionMessage {
  id: string;
  timestamp: number;
  from: 'ContentScript' | 'Background' | 'SidePanel';
  to: 'ContentScript' | 'Background' | 'SidePanel';
  type: 'DOM_EXTRACT' | 'INTENT_ANALYSIS' | 'LLM_REQUEST' | 'LLM_RESPONSE' | 'UI_UPDATE' | 'AUTO_PILOT' | 'AGENT_ACTION';
  payload: any;
}
