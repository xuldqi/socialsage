# Design Document: Agent Core Upgrade

## Overview

本设计文档描述 SocialSage AI 的 Agent 核心能力升级方案。目标是将当前的简单问答式聊天升级为具备工具调用、上下文感知、多轮对话追踪的真正 AI Agent。

核心设计原则：
1. **渐进式增强** — 在现有代码基础上扩展，不破坏已有功能
2. **模块化架构** — 工具、记忆、执行器分离，便于扩展
3. **用户可控** — 所有自动化行为可中断、可审核

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Sidebar                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Chat UI    │  │  Tool UI    │  │  Progress/Status UI     │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│  ┌──────▼────────────────▼──────────────────────▼──────────────┐│
│  │                    Agent Controller                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │ Intent       │  │ Context      │  │ Execution        │   ││
│  │  │ Tracker      │  │ Manager      │  │ Engine (ReAct)   │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └──────────────────────────┬───────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼───────────────────────────────────┐│
│  │                    Tool Registry                              ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐││
│  │  │Summarize│ │Extract  │ │Generate │ │Page     │ │Memory   │││
│  │  │Tool     │ │Tool     │ │Reply    │ │Action   │ │Search   │││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────┬────────────────────────────────┘
                                  │ Chrome Messaging
┌─────────────────────────────────▼────────────────────────────────┐
│                        Content Script                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐│
│  │ DOM Extractor│  │ Action       │  │ Selection/Event          ││
│  │              │  │ Executor     │  │ Listener                 ││
│  └──────────────┘  └──────────────┘  └──────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Agent Controller (`services/agentController.ts`)

核心控制器，协调所有 Agent 行为。

```typescript
interface AgentController {
  // 处理用户消息，返回响应流
  processMessage(
    message: string,
    context: AgentContext,
    onProgress?: (update: ProgressUpdate) => void
  ): AsyncGenerator<AgentResponse>;
  
  // 中断当前执行
  abort(): void;
  
  // 获取当前状态
  getState(): AgentState;
}

interface AgentContext {
  chatHistory: ChatMessage[];
  pageContext?: CapturedContext;
  selection?: string;
  memories: MemoryItem[];
  personas: Persona[];
  activePersonaId: string;
}

interface AgentState {
  status: 'idle' | 'thinking' | 'executing' | 'waiting_user';
  currentPlan?: ExecutionPlan;
  currentStep?: number;
  error?: string;
}
```

### 2. Intent Tracker (`services/intentTracker.ts`)

追踪多轮对话中的用户意图。

```typescript
interface IntentTracker {
  // 分析当前消息的意图
  analyzeIntent(message: string, history: ChatMessage[]): Promise<Intent>;
  
  // 解析引用（"那个"、"it"等）
  resolveReference(reference: string, context: AgentContext): string | null;
  
  // 获取当前追踪的意图
  getCurrentIntent(): Intent | null;
}

interface Intent {
  type: 'query' | 'command' | 'clarification' | 'confirmation';
  action?: string;  // e.g., 'summarize', 'extract', 'reply'
  target?: string;  // e.g., 'this page', 'selected text'
  parameters?: Record<string, any>;
  confidence: number;
}
```

### 3. Context Manager (`services/contextManager.ts`)

管理所有上下文信息。

```typescript
interface ContextManager {
  // 更新页面上下文
  updatePageContext(context: CapturedContext): void;
  
  // 更新选中文本
  updateSelection(text: string): void;
  
  // 检索相关记忆
  retrieveRelevantMemories(query: string, limit?: number): MemoryItem[];
  
  // 构建完整上下文
  buildContext(): AgentContext;
}
```

### 4. Tool Registry (`services/toolRegistry.ts`)

工具注册和调用框架。

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, any>, context: AgentContext): Promise<ToolResult>;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  displayText?: string;  // 用于展示给用户
}

interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  findByIntent(intent: Intent): Tool | null;
}
```

### 5. Execution Engine (`services/executionEngine.ts`)

ReAct 循环执行引擎。

```typescript
interface ExecutionEngine {
  // 创建执行计划
  createPlan(intent: Intent, context: AgentContext): Promise<ExecutionPlan>;
  
  // 执行计划
  execute(
    plan: ExecutionPlan,
    context: AgentContext,
    onStep?: (step: ExecutionStep) => void
  ): AsyncGenerator<ExecutionResult>;
  
  // 中断执行
  abort(): void;
}

interface ExecutionPlan {
  id: string;
  steps: PlannedStep[];
  estimatedDuration?: number;
}

interface PlannedStep {
  id: string;
  tool: string;
  parameters: Record<string, any>;
  dependsOn?: string[];  // 依赖的步骤 ID
}

interface ExecutionStep {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  thought?: string;      // Agent 的思考过程
  action?: string;       // 执行的动作
  observation?: string;  // 观察到的结果
}
```

### 6. Content Script Bridge (`services/contentScriptBridge.ts`)

Sidebar 与 Content Script 的通信桥梁。

```typescript
interface ContentScriptBridge {
  // 请求页面上下文
  requestPageContext(): Promise<CapturedContext>;
  
  // 执行页面操作
  executeAction(action: PageAction): Promise<ActionResult>;
  
  // 监听页面事件
  onPageEvent(callback: (event: PageEvent) => void): () => void;
  
  // 检查 Content Script 是否可用
  isAvailable(): Promise<boolean>;
}

interface PageAction {
  type: 'click' | 'fill' | 'scroll' | 'select';
  selector?: string;
  value?: string;
  options?: {
    humanLike?: boolean;  // 模拟人类行为
    delay?: number;
  };
}

interface PageEvent {
  type: 'selection' | 'navigation' | 'mutation' | 'focus';
  data: any;
}
```

## Data Models

### Tool Definitions

```typescript
// 内置工具定义
const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'summarize',
    description: '总结页面内容或选中文本',
    parameters: [
      { name: 'content', type: 'string', description: '要总结的内容', required: false },
      { name: 'maxLength', type: 'number', description: '最大长度', required: false, default: 200 }
    ],
    execute: async (params, context) => { /* ... */ }
  },
  {
    name: 'extract_data',
    description: '从页面提取结构化数据',
    parameters: [
      { name: 'entityType', type: 'string', description: '要提取的实体类型', required: false },
      { name: 'selector', type: 'string', description: 'CSS 选择器', required: false }
    ],
    execute: async (params, context) => { /* ... */ }
  },
  {
    name: 'generate_reply',
    description: '生成社交媒体回复',
    parameters: [
      { name: 'postContent', type: 'string', description: '原帖内容', required: true },
      { name: 'intent', type: 'string', description: '回复意图', required: false },
      { name: 'personaId', type: 'string', description: '使用的人设', required: false }
    ],
    execute: async (params, context) => { /* ... */ }
  },
  {
    name: 'search_memory',
    description: '搜索知识库',
    parameters: [
      { name: 'query', type: 'string', description: '搜索关键词', required: true }
    ],
    execute: async (params, context) => { /* ... */ }
  },
  {
    name: 'page_action',
    description: '在页面上执行操作',
    parameters: [
      { name: 'action', type: 'string', description: '操作类型', required: true },
      { name: 'target', type: 'string', description: '目标元素', required: true },
      { name: 'value', type: 'string', description: '输入值', required: false }
    ],
    execute: async (params, context) => { /* ... */ }
  }
];
```

### Message Format for LLM

```typescript
interface AgentSystemPrompt {
  role: string;
  capabilities: string[];
  tools: ToolDescription[];
  context: {
    pageInfo?: string;
    selection?: string;
    relevantMemories?: string[];
  };
  instructions: string;
}

// LLM 响应格式
interface LLMAgentResponse {
  thought: string;           // 思考过程
  action?: {
    tool: string;
    parameters: Record<string, any>;
  };
  response?: string;         // 直接回复（无需工具时）
  needsMoreInfo?: string;    // 需要用户提供更多信息
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Memory Retrieval Relevance
*For any* query string and memory collection, the memories returned by `retrieveRelevantMemories` should have higher semantic similarity scores to the query than memories not returned.
**Validates: Requirements 1.1**

### Property 2: Page Context Inclusion
*For any* user message processed when page context is available, the prompt sent to the LLM should contain the page context information.
**Validates: Requirements 1.4**

### Property 3: Reasoning Visibility Toggle
*For any* agent response when reasoning visibility is enabled, the response object should include a non-empty `reasoning` field.
**Validates: Requirements 1.5**

### Property 4: Tool Execution Flow
*For any* tool invocation, the execution should: (a) extract parameters from context, (b) execute the tool, (c) include tool result in response, and (d) log tool name and parameters.
**Validates: Requirements 2.2, 2.3, 2.6**

### Property 5: Tool Error Handling
*For any* tool execution that fails, the agent response should contain an error message and at least one alternative suggestion.
**Validates: Requirements 2.4**

### Property 6: Multi-Tool Sequencing
*For any* execution plan with dependencies, tools should execute in topological order respecting their `dependsOn` relationships.
**Validates: Requirements 2.5**

### Property 7: Context Capture on Events
*For any* sidebar open event, selection event, or significant DOM mutation, the corresponding context update message should be sent to the Agent.
**Validates: Requirements 3.1, 3.2, 3.5**

### Property 8: Noise Filtering
*For any* extracted page content, the result should not contain elements matching noise selectors (script, style, .ad, .advertisement, nav, footer).
**Validates: Requirements 3.4**

### Property 9: Content Chunking
*For any* content exceeding the token limit, the summarization process should split it into chunks before processing.
**Validates: Requirements 4.4**

### Property 10: Structured Extraction Output
*For any* data extraction result, the output should be valid JSON or a parseable table format.
**Validates: Requirements 5.2**

### Property 11: ReAct Loop Execution
*For any* multi-step task, the execution should: (a) create a plan, (b) emit progress updates for each step, (c) add observations to context before next action, and (d) produce a completion summary.
**Validates: Requirements 6.1, 6.2, 6.3, 6.6**

### Property 12: Abort on Stop Command
*For any* running execution, receiving a stop command ("stop", "取消") should halt execution within 100ms.
**Validates: Requirements 6.5**

### Property 13: Bidirectional Messaging
*For any* command sent from Sidebar to Content Script, a response should be received; and for any data captured by Content Script, the Sidebar should receive it.
**Validates: Requirements 7.1, 7.2**

### Property 14: Human-Like Typing
*For any* form fill action with `humanLike: true`, the typing should have variable delays between characters (50-150ms).
**Validates: Requirements 7.3**

### Property 15: Graceful Degradation
*For any* operation when Content Script is unavailable, the Agent should return a user-friendly error message instead of crashing.
**Validates: Requirements 7.4**

## Error Handling

1. **LLM API 错误**
   - 重试策略：指数退避，最多 3 次
   - 降级方案：切换到备用模型或返回预设响应

2. **Content Script 不可用**
   - 检测：发送 ping 消息，超时 1 秒视为不可用
   - 降级：禁用页面相关功能，提示用户刷新页面

3. **工具执行失败**
   - 记录错误日志
   - 向用户展示友好错误信息
   - 建议替代方案

4. **用户中断**
   - 使用 AbortController 传播中断信号
   - 清理中间状态
   - 保存已完成的部分结果

## Testing Strategy

### Unit Testing
- 使用 Vitest 作为测试框架
- 测试各个服务模块的独立功能
- Mock LLM API 响应

### Property-Based Testing
- 使用 fast-check 库进行属性测试
- 每个属性测试运行至少 100 次迭代
- 测试标注格式：`**Feature: agent-core-upgrade, Property {number}: {property_text}**`

### Integration Testing
- 测试 Sidebar ↔ Content Script 通信
- 测试完整的 ReAct 循环
- 使用 Puppeteer 模拟真实浏览器环境

### Test Coverage Goals
- 核心服务模块：>80% 覆盖率
- 工具实现：>90% 覆盖率
- 错误处理路径：100% 覆盖率
