# Implementation Plan

## Phase 1: 基础架构搭建

- [x] 1. 创建核心类型定义和接口
  - [x] 1.1 创建 `types/agent.ts` 定义 Agent 相关类型
    - 定义 AgentContext, AgentState, Intent, Tool, ToolResult 等接口
    - 定义 ExecutionPlan, ExecutionStep, ProgressUpdate 等类型
    - _Requirements: 2.1, 2.2, 6.1_
  - [x] 1.2 创建 `types/messaging.ts` 定义消息通信类型
    - 定义 PageAction, PageEvent, ActionResult 等接口
    - 定义 Chrome 消息格式
    - _Requirements: 7.1, 7.2_

- [x] 2. 实现 Tool Registry 工具注册框架
  - [x] 2.1 创建 `services/toolRegistry.ts` 实现工具注册
    - 实现 register, get, list, findByIntent 方法
    - 支持工具参数验证
    - _Requirements: 2.1, 2.2_
  - [ ]* 2.2 编写 Tool Registry 属性测试
    - **Property 4: Tool Execution Flow**
    - **Validates: Requirements 2.2, 2.3, 2.6**

- [x] 3. 实现内置工具
  - [x] 3.1 实现 `tools/summarizeTool.ts` 内容总结工具
    - 支持页面内容和选中文本总结
    - 实现长文本分块处理
    - _Requirements: 4.1, 4.4_
  - [ ]* 3.2 编写 summarize 工具属性测试
    - **Property 9: Content Chunking**
    - **Validates: Requirements 4.4**
  - [x] 3.3 实现 `tools/extractDataTool.ts` 数据提取工具
    - 支持实体类型过滤
    - 返回 JSON 格式结果
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 3.4 编写 extract 工具属性测试
    - **Property 10: Structured Extraction Output**
    - **Validates: Requirements 5.2**
  - [x] 3.5 实现 `tools/generateReplyTool.ts` 回复生成工具
    - 集成现有 generateReply 函数
    - 支持人设选择
    - _Requirements: 2.1_
  - [x] 3.6 实现 `tools/searchMemoryTool.ts` 记忆搜索工具
    - 实现语义相似度搜索
    - _Requirements: 1.1_
  - [ ]* 3.7 编写 memory search 属性测试
    - **Property 1: Memory Retrieval Relevance**
    - **Validates: Requirements 1.1**
  - [x] 3.8 实现 `tools/pageActionTool.ts` 页面操作工具
    - 支持 click, fill, scroll 操作
    - 实现人类行为模拟
    - _Requirements: 7.3_
  - [ ]* 3.9 编写 page action 属性测试
    - **Property 14: Human-Like Typing**
    - **Validates: Requirements 7.3**

- [x] 4. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Context 和 Intent 管理

- [x] 5. 实现 Context Manager 上下文管理器
  - [x] 5.1 创建 `services/contextManager.ts`
    - 实现 updatePageContext, updateSelection 方法
    - 实现 retrieveRelevantMemories 语义检索
    - 实现 buildContext 构建完整上下文
    - _Requirements: 1.1, 1.4, 3.2_
  - [ ]* 5.2 编写 Context Manager 属性测试
    - **Property 2: Page Context Inclusion**
    - **Validates: Requirements 1.4**

- [x] 6. 实现 Intent Tracker 意图追踪器
  - [x] 6.1 创建 `services/intentTracker.ts`
    - 实现 analyzeIntent 意图分析
    - 实现 resolveReference 引用解析
    - 实现 getCurrentIntent 获取当前意图
    - _Requirements: 1.2, 1.3_
  - [ ]* 6.2 编写 Intent Tracker 单元测试
    - 测试常见意图识别场景
    - _Requirements: 1.2_

## Phase 3: 执行引擎

- [x] 7. 实现 Execution Engine ReAct 循环
  - [x] 7.1 创建 `services/executionEngine.ts`
    - 实现 createPlan 创建执行计划
    - 实现 execute 异步生成器执行
    - 实现 abort 中断机制
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [ ]* 7.2 编写 Execution Engine 属性测试
    - **Property 11: ReAct Loop Execution**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**
  - [ ]* 7.3 编写中断机制属性测试
    - **Property 12: Abort on Stop Command**
    - **Validates: Requirements 6.5**

- [x] 8. 实现错误处理和降级
  - [x] 8.1 创建 `services/errorHandler.ts`
    - 实现重试策略
    - 实现降级方案
    - _Requirements: 2.4, 6.4_
  - [ ]* 8.2 编写错误处理属性测试
    - **Property 5: Tool Error Handling**
    - **Validates: Requirements 2.4**

- [x] 9. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: 浏览器集成

- [x] 10. 实现 Content Script Bridge 通信桥梁
  - [x] 10.1 创建 `services/contentScriptBridge.ts`
    - 实现 requestPageContext 请求页面上下文
    - 实现 executeAction 执行页面操作
    - 实现 onPageEvent 监听页面事件
    - 实现 isAvailable 检查可用性
    - _Requirements: 7.1, 7.2, 7.4_
  - [ ]* 10.2 编写 Bridge 属性测试
    - **Property 13: Bidirectional Messaging**
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 10.3 编写降级属性测试
    - **Property 15: Graceful Degradation**
    - **Validates: Requirements 7.4**

- [x] 11. 升级 Content Script
  - [x] 11.1 更新 `content_script.ts` 消息处理
    - 添加 DOM_EXTRACT 消息处理
    - 添加 PAGE_ACTION 消息处理
    - 添加页面事件监听和上报
    - _Requirements: 3.1, 3.4, 3.5_
  - [ ]* 11.2 编写 Content Script 属性测试
    - **Property 7: Context Capture on Events**
    - **Validates: Requirements 3.1, 3.2, 3.5**
  - [ ]* 11.3 编写噪音过滤属性测试
    - **Property 8: Noise Filtering**
    - **Validates: Requirements 3.4**

- [x] 12. Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Agent Controller 集成

- [x] 13. 实现 Agent Controller 核心控制器
  - [x] 13.1 创建 `services/agentController.ts`
    - 实现 processMessage 消息处理主流程
    - 集成 IntentTracker, ContextManager, ExecutionEngine
    - 实现 abort 和 getState 方法
    - _Requirements: 1.2, 1.4, 2.1, 6.1_
  - [ ]* 13.2 编写 Agent Controller 属性测试
    - **Property 3: Reasoning Visibility Toggle**
    - **Validates: Requirements 1.5**

- [x] 14. 更新 LLM 提示词
  - [x] 14.1 更新 `services/geminiService.ts` 系统提示
    - 添加工具描述到系统提示
    - 定义 LLM 响应格式（thought/action/response）
    - 支持 ReAct 格式输出
    - _Requirements: 2.1, 2.6_

## Phase 6: UI 集成

- [x] 15. 更新 ExtensionSidebar 聊天界面
  - [x] 15.1 更新 `components/ExtensionSidebar.tsx`
    - 集成 AgentController
    - 显示思考过程和工具调用
    - 显示执行进度
    - 支持中断操作
    - _Requirements: 1.5, 2.6, 6.2, 6.5_
  - [x] 15.2 添加工具结果展示组件
    - 创建 `components/ToolResultDisplay.tsx`
    - 支持 JSON、表格、文本等格式展示
    - _Requirements: 5.2, 5.4_

- [x] 16. 更新 App.tsx 状态管理
  - [x] 16.1 更新 `App.tsx` 集成新服务
    - 初始化 AgentController
    - 连接 Content Script Bridge
    - 处理页面事件
    - _Requirements: 3.1, 7.5_

- [x] 17. Final Checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: 端到端测试

- [x]* 18. 编写集成测试
  - [x]* 18.1 编写完整对话流程测试
    - 测试多轮对话意图追踪
    - 测试工具调用和结果整合
    - _Requirements: 1.2, 2.3_
  - [ ]* 18.2 编写浏览器集成测试
    - 使用 Puppeteer 测试真实页面交互
    - 测试 Sidebar ↔ Content Script 通信
    - _Requirements: 7.1, 7.2_

- [x]* 19. 编写多工具编排属性测试
  - **Property 6: Multi-Tool Sequencing**
  - **Validates: Requirements 2.5**
