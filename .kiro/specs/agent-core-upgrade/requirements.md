# Requirements Document

## Introduction

本文档定义了 SocialSage AI 的 Agent 核心能力升级需求。目标是将当前的简单问答式聊天升级为具备工具调用、上下文感知、多轮对话追踪的真正 AI Agent，能够自主完成网页信息抓取、内容总结、数据提取等任务。

## Glossary

- **Agent**: 具备自主规划和执行能力的 AI 系统，能够根据用户意图调用工具完成任务
- **Tool**: Agent 可调用的功能模块，如网页抓取、内容总结、数据提取等
- **ReAct Loop**: "Reasoning + Acting" 循环，Agent 通过思考-行动-观察的迭代完成复杂任务
- **Context Window**: Agent 可感知的上下文范围，包括对话历史、页面内容、用户记忆等
- **Intent**: 用户的意图，Agent 需要识别并追踪跨多轮对话的意图
- **Memory Retrieval**: 基于语义相关性从知识库中检索相关记忆
- **Content Script**: Chrome 扩展中运行在网页上下文的脚本，负责 DOM 操作和数据提取

## Requirements

### Requirement 1: 增强聊天核心

**User Story:** As a user, I want the AI assistant to understand my context better and maintain conversation state, so that I can have natural multi-turn conversations without repeating myself.

#### Acceptance Criteria

1. WHEN a user sends a message THEN the Agent SHALL retrieve relevant memories from the knowledge base based on semantic similarity
2. WHEN a conversation spans multiple turns THEN the Agent SHALL maintain and track the user's intent across the conversation
3. WHEN the user references previous context (e.g., "那个", "it", "刚才说的") THEN the Agent SHALL correctly resolve the reference
4. WHILE processing a user message THEN the Agent SHALL consider the current page context if available
5. WHEN the Agent generates a response THEN the Agent SHALL include reasoning steps visible to the user (optional toggle)

### Requirement 2: 工具调用框架

**User Story:** As a user, I want to ask the AI to perform actions like extracting data or summarizing content, so that I can accomplish tasks through natural language commands.

#### Acceptance Criteria

1. WHEN a user expresses an intent that requires a tool THEN the Agent SHALL identify and select the appropriate tool
2. WHEN the Agent selects a tool THEN the Agent SHALL extract the required parameters from the conversation context
3. WHEN a tool execution completes THEN the Agent SHALL incorporate the result into its response
4. IF a tool execution fails THEN the Agent SHALL report the error and suggest alternatives
5. WHEN multiple tools are needed THEN the Agent SHALL plan and execute them in the correct sequence
6. WHEN the Agent uses a tool THEN the Agent SHALL display the tool name and parameters to the user

### Requirement 3: 网页信息抓取与识别

**User Story:** As a user, I want the AI to automatically understand the current webpage content, so that I can ask questions about it or request actions on it.

#### Acceptance Criteria

1. WHEN the extension sidebar opens THEN the Content Script SHALL extract and send page metadata to the Agent
2. WHEN the user selects text on the page THEN the Agent SHALL receive the selection as context
3. WHEN the user asks about "this page" or "当前页面" THEN the Agent SHALL use the captured page context
4. WHEN extracting page content THEN the Content Script SHALL filter out noise (ads, navigation, scripts)
5. WHEN the page content changes significantly THEN the Content Script SHALL notify the Agent of the update

### Requirement 4: 内容总结工具

**User Story:** As a user, I want to ask the AI to summarize the current page or selected content, so that I can quickly understand long articles or posts.

#### Acceptance Criteria

1. WHEN the user requests a summary THEN the Agent SHALL invoke the summarize tool with the appropriate content
2. WHEN summarizing THEN the Agent SHALL produce a concise summary preserving key points
3. WHEN the content is a video page THEN the Agent SHALL attempt to summarize based on available transcript or description
4. WHEN the content exceeds token limits THEN the Agent SHALL use chunking and progressive summarization

### Requirement 5: 数据提取工具

**User Story:** As a user, I want to extract structured data from webpages, so that I can collect information like contact details, product specs, or social media metrics.

#### Acceptance Criteria

1. WHEN the user requests data extraction THEN the Agent SHALL identify extractable entities on the page
2. WHEN extracting data THEN the Agent SHALL return results in a structured format (JSON or table)
3. WHEN the user specifies what to extract (e.g., "提取所有邮箱") THEN the Agent SHALL filter results accordingly
4. WHEN extraction completes THEN the Agent SHALL offer to save results to memory or copy to clipboard

### Requirement 6: ReAct Agent 循环

**User Story:** As a user, I want the AI to handle complex multi-step tasks autonomously, so that I don't have to guide it through each step manually.

#### Acceptance Criteria

1. WHEN a task requires multiple steps THEN the Agent SHALL create an execution plan
2. WHILE executing a plan THEN the Agent SHALL show progress and current step to the user
3. WHEN an action produces an observation THEN the Agent SHALL reason about the result before the next action
4. IF the Agent gets stuck or encounters an error THEN the Agent SHALL ask the user for guidance
5. WHEN the user says "stop" or "取消" THEN the Agent SHALL immediately halt execution
6. WHEN a task completes THEN the Agent SHALL summarize what was accomplished

### Requirement 7: 浏览器集成通信

**User Story:** As a user, I want the sidebar and webpage to work together seamlessly, so that the AI can both read from and act on the current page.

#### Acceptance Criteria

1. WHEN the sidebar sends a command THEN the Content Script SHALL execute it on the page
2. WHEN the Content Script captures data THEN the Sidebar SHALL receive it via Chrome messaging
3. WHEN filling a form or reply box THEN the Content Script SHALL simulate human-like typing
4. IF the Content Script is not available THEN the Agent SHALL gracefully degrade and inform the user
5. WHEN the user navigates to a new page THEN the Content Script SHALL re-initialize and capture new context
