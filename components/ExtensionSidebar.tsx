import React, { useState, useEffect, useRef } from 'react';
import { ExtensionContext, Persona, AutoRule, MemoryItem, UserSettings, SystemLog, SocialPost, SystemOperation, ExtensionTab, ExtensionMessage, AutoPilotStatus, ChatMessage, AgentAction, ReplyHistory } from '../types';
import { generateReply, processUserIntent, processUserIntentStream, analyzeProfileStyle, analyzePostStyle, planPageInteraction, extractStructuredData, summarizeVideoContent, explainSelection, chatWithPage, AIConfig, testApiConnection, getRemainingQuota, polishContent } from '../services/geminiService';
import { SparklesIcon, RobotIcon, UsersIcon, EditIcon, ZapIcon, SendIcon, RefreshIcon, SettingsIcon, FileTextIcon, VideoIcon, TableIcon, MessageSquareIcon, SearchIcon, GlobeIcon, MailIcon, ImageIcon, TerminalIcon, CodeIcon, BrainIcon, PlusIcon, TrashIcon, BookmarkIcon, UserPlusIcon, PlayIcon, MagicIcon, ListPlusIcon, ShieldIcon, CheckIcon, CopyIcon, BarChartIcon, FingerprintIcon, TrendingUpIcon, ChevronDownIcon, StopIcon, ClockIcon, XIcon } from './Icons';
import RuleBuilder from './RuleBuilder';
import PersonaManager from './PersonaManager';
import PostGenerator from './PostGenerator';

declare const chrome: any;

// Localization Dictionary (Using "Auto-Reply" consistently)
const TRANSLATIONS: Record<string, Record<string, string>> = {
    en: {
        nav_chat: "Chat",
        nav_assist: "Assist",
        nav_drafts: "Drafts",
        nav_rules: "Rules",
        nav_personas: "Personas",
        nav_stats: "Stats",
        nav_memory: "Memory",
        nav_logs: "Logs",
        nav_queue: "Queue",
        status_idle: "IDLE",
        status_working: "WORKING",
        status_secure: "SECURE",
        status_active: "ACTIVE",
        btn_start_auto: "START AUTO-REPLY",
        btn_stop_auto: "STOP AUTO-REPLY",
        btn_transfer: "Safe Fill",
        btn_refine: "Refine",
        btn_clone: "Clone Style",
        btn_extract: "Extract Data",
        btn_summarize: "Summarize",
        btn_stop_edit: "Stop & Edit",
        btn_protected: "Protected & Synced",
        card_target_post: "Target Post",
        card_current_page: "Current Page",
        card_page_inspector: "DOM Inspector",
        card_detected_persona: "Detected Persona",
        card_agent: "Agent Actions",
        card_quick_draft: "Quick Draft",
        card_ai_draft: "AI Draft",
        lbl_auto_detect: "AUTO-DETECT ON",
        lbl_thinking: "Thinking Process",
        lbl_save: "Save",
        msg_welcome_chat: "How can I help you manage your social presence?",
        msg_crafting: "Crafting reply...",
        msg_open_reply: "⚠️ Open a reply box to transfer",
        msg_high_risk: "High risk of detection. Recommended to slow down.",
        msg_stealth: "Stealth mode active. Human-like jitter enabled.",
        msg_risk_badge: "⚠️ HIGH RISK",
        msg_balanced: "Balanced speed and safety.",
        alert_conn_success: "Connection Successful! 🚀",
        alert_conn_fail: "Connection Failed:",
        placeholder_chat: "Ask anything (e.g. 'Optimize this draft', 'Create a rule')...",
        placeholder_agent: 'e.g. "Like this post" or "Find email"',
        placeholder_draft: "Draft will appear here...",
        settings_title: "Settings",
        settings_desc: "Configure your AI provider and behavior.",
        settings_api_key: "API Key",
        settings_model: "AI Model Provider",
        settings_speed: "Auto-Reply Speed",
        settings_mode: "Auto-Reply Mode",
        settings_language: "Language / 语言",
        settings_output_lang: "Output Language",
        stats_time_saved: "Time Saved",
        stats_posts_replied: "Posts Replied",
        stats_safety: "Safety Score",
        stats_activity: "Activity Last 7 Days",
        mem_kb: "Knowledge Base",
        mem_placeholder: "Add a fact, link, or preference...",
        mem_add: "Add",
        mem_empty: "No memories yet.",
        model_flash: "Gemini 2.5 Flash (Fast / Free Tier)",
        model_pro: "Gemini 2.5 Pro (High Quality)",
        model_next: "Gemini 3.0 Pro (Next Gen)",
        model_ds_chat: "DeepSeek-V3 (Chat)",
        model_ds_reasoner: "DeepSeek-R1 (Reasoning)",
        model_custom: "Custom / OpenAI Compatible",
        speed_fast_label: "🚀 Fast",
        speed_human_label: "👤 Human",
        speed_slow_label: "🛡️ Turtle",
        mode_auto_label: "⚡ Full Auto",
        mode_review_label: "✋ Review Queue",
        btn_test: "Test",
        btn_backup: "Export Backup",
        btn_import: "Import Config",
        btn_reset: "Reset All Data",
        action_translate: "Translate",
        intent_agree: "Agree",
        intent_disagree: "Disagree",
        intent_humor: "Humorous",
        intent_question: "Question",
        think_scanning: "Scanning feed...",
        think_analyzing: "Analyzing post content...",
        think_skipping: "No rule matched. Skipping.",
        think_matched: "Rule Matched!",
        think_liking: "Simulating 'Like' action...",
        think_drafting: "Drafting response...",
        think_cooling: "Cooling down...",
        queue_title: "Review Queue",
        queue_empty: "No drafts pending review.",
        btn_approve: "Approve",
        btn_reject: "Reject",
        auto_reply_mode: "Auto-Reply Mode",
        generating_reply: "Generating reply...",
        waiting_review: "Waiting for review...",
        confirm_send: "Confirm & Send",
        reject_reply: "Reject"
    },
    zh: {
        nav_chat: "聊天",
        nav_assist: "助手",
        nav_drafts: "草稿",
        nav_rules: "规则",
        nav_personas: "人设",
        nav_stats: "统计",
        nav_memory: "记忆",
        nav_logs: "日志",
        nav_queue: "审核",
        status_idle: "空闲",
        status_working: "运行中",
        status_secure: "安全",
        status_active: "活跃",
        btn_start_auto: "开启自动回复",
        btn_stop_auto: "停止自动回复",
        btn_transfer: "安全填充",
        btn_refine: "智能润色",
        btn_clone: "克隆风格",
        btn_extract: "提取数据",
        btn_summarize: "总结视频",
        btn_stop_edit: "停止并编辑",
        btn_protected: "已保护并同步",
        card_target_post: "目标帖子",
        card_current_page: "当前页面",
        card_page_inspector: "DOM 透视 (实时)",
        card_detected_persona: "检测到的人设",
        card_agent: "Agent 操作",
        card_quick_draft: "快速起草",
        card_ai_draft: "AI 草稿",
        lbl_auto_detect: "自动检测",
        lbl_thinking: "思考过程",
        lbl_save: "保存",
        msg_welcome_chat: "我是您的智能助手，有什么可以帮您？",
        msg_crafting: "正在撰写回复...",
        msg_open_reply: "⚠️ 请在浏览器中打开回复框以填充",
        msg_high_risk: "高风险，容易被检测。建议减速。",
        msg_stealth: "隐形模式已激活。已启用拟人化抖动。",
        msg_risk_badge: "⚠️ 高风险",
        msg_balanced: "平衡的速度与安全性。",
        alert_conn_success: "连接成功！🚀",
        alert_conn_fail: "连接失败：",
        placeholder_chat: "随便聊聊（如：帮我优化这段话，或者创建规则）...",
        placeholder_agent: '比如："点赞这个帖子" 或 "查找邮箱"',
        placeholder_draft: "生成的草稿将显示在这里...",
        settings_title: "设置",
        settings_desc: "配置您的 AI 提供商和行为逻辑。",
        settings_api_key: "API 密钥",
        settings_model: "AI 模型提供商",
        settings_speed: "自动回复速度",
        settings_mode: "自动回复模式",
        settings_language: "界面语言",
        settings_output_lang: "输出语言",
        stats_time_saved: "节省时间",
        stats_posts_replied: "自动回复数",
        stats_safety: "安全评分",
        stats_activity: "过去7天活动",
        mem_kb: "知识库 / 记忆",
        mem_placeholder: "添加事实、链接或偏好...",
        mem_add: "添加",
        mem_empty: "暂无记忆数据",
        model_flash: "Gemini 2.5 Flash (快速 / 免费额度)",
        model_pro: "Gemini 2.5 Pro (高质量)",
        model_next: "Gemini 3.0 Pro (下一代)",
        model_ds_chat: "DeepSeek-V3 (对话)",
        model_ds_reasoner: "DeepSeek-R1 (推理)",
        model_custom: "自定义 / OpenAI 兼容",
        speed_fast_label: "🚀 极速",
        speed_human_label: "👤 拟人",
        speed_slow_label: "🛡️ 龟速",
        mode_auto_label: "⚡ 全自动",
        mode_review_label: "✋ 审核队列",
        btn_test: "测试连接",
        btn_backup: "导出备份",
        btn_import: "导入配置",
        btn_reset: "重置所有数据",
        action_translate: "翻译选中",
        intent_agree: "同意",
        intent_disagree: "反对",
        intent_humor: "幽默",
        intent_question: "提问",
        think_scanning: "扫描信息流...",
        think_analyzing: "正在分析帖子内容...",
        think_skipping: "无匹配规则，跳过。",
        think_matched: "命中规则！",
        think_liking: "模拟“点赞”操作...",
        think_drafting: "正在生成回复...",
        think_cooling: "冷却等待中...",
        queue_title: "待审核队列",
        queue_empty: "暂无待审核草稿。",
        btn_approve: "批准发送",
        btn_reject: "拒绝",
        auto_reply_mode: "自动回复模式",
        generating_reply: "正在生成回复...",
        waiting_review: "等待确认...",
        confirm_send: "确认发送",
        reject_reply: "拒绝"
    },
    ja: {
        nav_chat: "チャット",
        nav_assist: "アシスト",
        nav_drafts: "下書き",
        nav_rules: "ルール",
        nav_personas: "ペルソナ",
        nav_stats: "統計",
        nav_memory: "メモリ",
        nav_logs: "ログ",
        nav_queue: "レビュー",
        status_idle: "待機中",
        status_working: "実行中",
        status_secure: "安全",
        status_active: "アクティブ",
        btn_start_auto: "自動返信を開始",
        btn_stop_auto: "自動返信を停止",
        btn_transfer: "安全入力",
        btn_refine: "AIリライト",
        btn_clone: "スタイル複製",
        btn_extract: "データ抽出",
        btn_summarize: "要約",
        btn_stop_edit: "停止・編集",
        btn_protected: "保護・同期済み",
        card_target_post: "ターゲット投稿",
        card_current_page: "現在のページ",
        card_page_inspector: "DOMインスペクター",
        card_detected_persona: "検出されたペルソナ",
        card_agent: "エージェント操作",
        card_quick_draft: "クイックドラフト",
        card_ai_draft: "AIドラフト",
        lbl_auto_detect: "自動検出 ON",
        lbl_thinking: "思考プロセス",
        lbl_save: "保存",
        msg_welcome_chat: "何かお手伝いできることはありますか？",
        msg_crafting: "返信を作成中...",
        msg_open_reply: "⚠️ 入力するにはブラウザで返信ボックスを開いてください",
        msg_high_risk: "検出リスクが高いです。速度を落とすことを推奨します。",
        msg_stealth: "ステルスモード有効。人間らしい揺らぎを有効化。",
        msg_risk_badge: "⚠️ 高リスク",
        msg_balanced: "速度と安全性のバランス。",
        alert_conn_success: "接続成功！🚀",
        alert_conn_fail: "接続失敗：",
        placeholder_chat: "何でも聞いてください（例：このドラフトを修正して）...",
        placeholder_agent: '例：「いいね」して、またはメールを探して',
        placeholder_draft: "ここにドラフトが表示されます...",
        settings_title: "設定",
        settings_desc: "AIプロバイダーと動作を設定します。",
        settings_api_key: "APIキー",
        settings_model: "AIモデルプロバイダー",
        settings_speed: "自動返信速度",
        settings_mode: "自動返信モード",
        settings_language: "言語 (Language)",
        settings_output_lang: "出力言語",
        stats_time_saved: "節約時間",
        stats_posts_replied: "返信数",
        stats_safety: "安全スコア",
        stats_activity: "過去7日間のアクティビティ",
        mem_kb: "ナレッジベース",
        mem_placeholder: "事実、リンク、好みを追加...",
        mem_add: "追加",
        mem_empty: "メモリはありません",
        model_flash: "Gemini 2.5 Flash (高速 / 無料枠)",
        model_pro: "Gemini 2.5 Pro (高品質)",
        model_next: "Gemini 3.0 Pro (次世代)",
        model_ds_chat: "DeepSeek-V3 (チャット)",
        model_ds_reasoner: "DeepSeek-R1 (推論)",
        model_custom: "カスタム / OpenAI互換",
        speed_fast_label: "🚀 高速",
        speed_human_label: "👤 人間",
        speed_slow_label: "🛡️ カメ",
        mode_auto_label: "⚡ フルオート",
        mode_review_label: "✋ レビュー",
        btn_test: "接続テスト",
        btn_backup: "バックアップ",
        btn_import: "インポート",
        btn_reset: "リセット",
        action_translate: "翻訳",
        intent_agree: "同意",
        intent_disagree: "反対",
        intent_humor: "ユーモア",
        intent_question: "質問",
        think_scanning: "スキャン中...",
        think_analyzing: "分析中...",
        think_skipping: "ルール不一致。スキップ。",
        think_matched: "ルール一致！",
        think_liking: "「いいね」を実行中...",
        think_drafting: "返信を作成中...",
        think_cooling: "クールダウン中...",
        queue_title: "レビューキュー",
        queue_empty: "レビュー待ちの下書きはありません。",
        btn_approve: "承認",
        btn_reject: "却下",
        auto_reply_mode: "自動返信モード",
        generating_reply: "返信を生成中...",
        waiting_review: "レビュー待ち...",
        confirm_send: "確認して送信",
        reject_reply: "却下"
    }
};

interface ExtensionSidebarProps {
    context: ExtensionContext;
    personas: Persona[];
    defaultPersonaId?: string;
    rules: AutoRule[];
    memories: MemoryItem[];
    settings: UserSettings;
    systemLogs: SystemLog[];
    isAutoPilot: boolean;
    posts?: SocialPost[];
    hasConfiguredAutoPilot?: boolean;
    externalActiveTab?: ExtensionTab;
    initialChatMsgs?: string[] | null;
    onUpdateSettings: (s: UserSettings) => void;
    onApplyDraft: (postId: string, draft: string) => void;
    onPerformOperations: (ops: SystemOperation[]) => void;
    onAddMemory: (content: string) => void;
    onDeleteMemory: (id: string) => void;
    onToggleAutoPilot: () => void;
    onExecuteAgent: (actions: AgentAction[]) => void;
    onUpdateRule: (r: AutoRule) => void;
    onDeleteRule: (id: string) => void;
    onUpdatePersona: (p: Persona) => void;
    onCreatePersona: (p: Persona) => void;
    onDeletePersona: (id: string) => void;
    onSetDefaultPersona: (id: string) => void;
    onAddSystemLog: (action: string, details: string, source?: 'User' | 'AI Agent' | 'Auto-Pilot') => void;
    onUpdatePost?: (post: SocialPost) => void; // New: For Queue actions
    replyHistory?: ReplyHistory[]; // New: Reply history for deletion
    onDeleteReply?: (replyId: string) => void; // New: Delete a reply
    onRecordReply?: (post: SocialPost, replyContent: string, url?: string, elementSelector?: string) => void; // New: Record a sent reply
}

// Sub-component for Context Actions above Chat
const ContextActions = ({ context, onAction, t }: { context: ExtensionContext, onAction: (a: string) => void, t: any }) => {
    if (!context.pageData && !context.selection) return null;
    return (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
            {context.postData && (
                <button onClick={() => onAction('clone')} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100 hover:bg-indigo-100 whitespace-nowrap flex items-center">
                    <UserPlusIcon className="w-3 h-3 mr-1" /> {t('btn_clone')}
                </button>
            )}
            {context.pageData?.type === 'video' && (
                <button onClick={() => onAction('summarize')} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-100 whitespace-nowrap flex items-center">
                    <VideoIcon className="w-3 h-3 mr-1" /> {t('btn_summarize')}
                </button>
            )}
            {context.selection && (
                <button onClick={() => onAction('translate')} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-100 whitespace-nowrap flex items-center">
                    <GlobeIcon className="w-3 h-3 mr-1" /> {t('action_translate')}
                </button>
            )}
            <button onClick={() => onAction('extract')} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-100 whitespace-nowrap flex items-center">
                <TableIcon className="w-3 h-3 mr-1" /> {t('btn_extract')}
            </button>
        </div>
    );
};

const ExtensionSidebar: React.FC<ExtensionSidebarProps> = ({
    context, personas, defaultPersonaId, rules, memories, settings, systemLogs, isAutoPilot, posts = [], hasConfiguredAutoPilot, externalActiveTab, initialChatMsgs,
    onUpdateSettings, onApplyDraft, onPerformOperations, onAddMemory, onDeleteMemory, onToggleAutoPilot, onExecuteAgent, onUpdateRule, onDeleteRule, onUpdatePersona, onCreatePersona, onDeletePersona, onSetDefaultPersona,
    onAddSystemLog, onUpdatePost, replyHistory = [], onDeleteReply, onRecordReply
}) => {
    const [activeTab, setActiveTab] = useState<ExtensionTab>('context'); // Default Context First
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Draft State
    const [draft, setDraft] = useState(() => localStorage.getItem('socialsage_active_draft') || '');
    useEffect(() => { localStorage.setItem('socialsage_active_draft', draft); }, [draft]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [transferStatus, setTransferStatus] = useState<'idle' | 'success'>('idle');
    const [remainingQuota, setRemainingQuota] = useState(10);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Analysis State
    const [analyzedPersona, setAnalyzedPersona] = useState<Partial<Persona> | null>(null);
    const [extractedData, setExtractData] = useState<string>('');
    const [videoSummary, setVideoSummary] = useState<string>('');
    const [selectionExplanation, setSelectionExplanation] = useState<string>('');

    // Input State
    const [memoryInput, setMemoryInput] = useState('');
    const [chatInput, setChatInput] = useState('');
    const [agentInput, setAgentInput] = useState('');

    // Bus / Debug State
    const [busMessages, setBusMessages] = useState<ExtensionMessage[]>([]);

    // Loading States
    const [isChatting, setIsChatting] = useState(false);
    const [isPageProcessing, setIsPageProcessing] = useState(false);
    const [isAgentPlanning, setIsAgentPlanning] = useState(false);

    const [lastIntent, setLastIntent] = useState<string>('');
    const [usedMemoryForDraft, setUsedMemoryForDraft] = useState<MemoryItem | null>(null);
    const processedIntentTimestamp = useRef<number>(0);

    const abortControllerRef = useRef<AbortController | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const busBottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Chat editing state
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState<string>('');
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

    // Helper for Translations
    const t = (key: string) => {
        const lang = settings.language || 'en';
        return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key;
    };

    const pendingReviewCount = posts.filter(p => p.reviewStatus === 'pending').length;

    const INTENT_OPTIONS = [
        { id: 'Agree', label: t('intent_agree') },
        { id: 'Disagree', label: t('intent_disagree') },
        { id: 'Humorous', label: t('intent_humor') },
        { id: 'Question', label: t('intent_question') }
    ];

    // Sync props to state
    useEffect(() => { if (externalActiveTab) setActiveTab(externalActiveTab); }, [externalActiveTab]);

    // React to Immediate Intent (from Browser Simulation)
    useEffect(() => {
        // Check if context has a valid intent AND it's newer than the last one we processed
        if (context.immediateIntent && context.postData && context.immediateIntent.timestamp > processedIntentTimestamp.current) {
            processedIntentTimestamp.current = context.immediateIntent.timestamp;
            // Trigger Generation
            handleAutoDraft(context.postData, context.immediateIntent.action);
        }
    }, [context.immediateIntent, context.postData]);

    // Play initial messages sequentially
    useEffect(() => {
        if (initialChatMsgs && initialChatMsgs.length > 0) {
            // Do not clear history to allow appending help text
            let timerIds: ReturnType<typeof setTimeout>[] = [];
            initialChatMsgs.forEach((msg, index) => {
                const tid = setTimeout(() => {
                    setMessages(prev => {
                        if (prev.length > 0 && prev[prev.length - 1].content === msg) return prev;
                        return [...prev, { id: Date.now().toString() + Math.random(), role: 'assistant', content: msg, timestamp: Date.now() }];
                    });
                }, index * 600);
                timerIds.push(tid);
            });
            return () => timerIds.forEach(clearTimeout);
        }
    }, [initialChatMsgs]);

    // Inject System Logs into Chat
    useEffect(() => {
        if (systemLogs.length > 0) {
            const lastLog = systemLogs[systemLogs.length - 1];
            // Only show interesting logs in chat
            if (lastLog.source === 'Auto-Pilot' && (lastLog.action.includes('Replied') || lastLog.action.includes('Liked'))) {
                setMessages(prev => [...prev, {
                    id: 'sys-' + lastLog.id,
                    role: 'system',
                    content: `${lastLog.action}: ${lastLog.details}`,
                    timestamp: lastLog.timestamp
                }]);
            }
        }
    }, [systemLogs]);

    useEffect(() => { getRemainingQuota().then(setRemainingQuota); }, [isGenerating]);

    useEffect(() => {
        if (!isGenerating && context.draftContent !== undefined) {
            setDraft(context.draftContent);
        }
    }, [context.draftContent, isGenerating]);

    useEffect(() => {
        if (transferStatus === 'success') {
            // Keep success status until draft changes significantly or post changes
            // Logic handled in render mostly, but can reset here if context changes
        }
    }, [draft, context.postData?.id]);

    useEffect(() => {
        if (activeTab === 'chat' && chatBottomRef.current) {
            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab, isChatting]);

    useEffect(() => {
        if (activeTab === 'logs' && busBottomRef.current) {
            busBottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [busMessages, activeTab]);

    // Auto-resize Textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 80) + 'px';
        }
    }, [chatInput]);

    const logBus = (from: ExtensionMessage['from'], to: ExtensionMessage['to'], type: ExtensionMessage['type'], payload: any) => {
        const safePayload = JSON.parse(JSON.stringify(payload));
        if (safePayload.apiKey) safePayload.apiKey = 'sk-******';
        const msg: ExtensionMessage = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            from, to, type, payload: safePayload
        };
        setBusMessages(prev => [...prev, msg]);
    };

    const getAiConfig = (signal?: AbortSignal): AIConfig => {
        const lang = settings.outputLanguage === 'same' || !settings.outputLanguage ? settings.language : settings.outputLanguage;

        // For custom/OpenAI compatible models (DeepSeek, etc.)
        if (settings.selectedModel === 'custom' || settings.selectedModel.startsWith('deepseek')) {
            // 对于 DeepSeek 预设模型，使用 selectedModel 作为模型名
            // 对于自定义模型，使用 customModelName
            let modelName = settings.customModelName;
            if (settings.selectedModel.startsWith('deepseek')) {
                modelName = settings.selectedModel; // 直接使用 'deepseek-chat' 或 'deepseek-reasoner'
            }

            // 默认使用 DeepSeek API（如果用户没有设置 Base URL）
            const baseUrl = settings.customBaseUrl ||
                (settings.selectedModel.startsWith('deepseek') ? 'https://api.deepseek.com/v1' : undefined);

            return {
                apiKey: settings.customApiKey,
                baseUrl: baseUrl,
                customModel: modelName || 'deepseek-chat',
                signal,
                outputLanguage: lang
            };
        }

        // For Gemini models - 使用 customApiKey，这是用户在设置中输入的 API Key
        return {
            apiKey: settings.customApiKey,  // 修复：之前错误地使用了 settings.apiKey
            signal,
            outputLanguage: lang
        };
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setDraft(prev => prev || '');
    };

    const handleAutoDraft = async (post: SocialPost, explicitIntent?: string) => {
        if (!post) return;
        handleStopGeneration();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setIsGenerating(true);
        setAnalyzedPersona(null);
        setUsedMemoryForDraft(null);
        if (explicitIntent) setLastIntent(explicitIntent);
        const intentToUse = explicitIntent || lastIntent;
        const activePersona = personas.find(p => p.id === defaultPersonaId) || personas[0];
        const instruction = intentToUse ? `User Intent: ${intentToUse}.` : undefined;

        try {
            const result = await generateReply(
                post,
                activePersona,
                instruction,
                settings.selectedModel,
                memories,
                getAiConfig(abortController.signal)
            );
            if (!abortController.signal.aborted) {
                setDraft(result);
                getRemainingQuota().then(setRemainingQuota);
                if (result.length > 20 && memories.length > 0) setUsedMemoryForDraft(memories[0]);
                logBus('SidePanel', 'Background', 'LLM_REQUEST', { task: 'generate_draft', model: settings.selectedModel });
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error(e);
                if (e.message && e.message.includes("Quota")) setDraft(e.message);
            }
        } finally {
            if (abortControllerRef.current === abortController) {
                setIsGenerating(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleRefineDraft = async () => {
        if (!draft) return;
        handleStopGeneration();
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setIsGenerating(true);
        const persona = personas.find(p => p.id === defaultPersonaId) || personas[0];
        try {
            const result = await polishContent(
                draft,
                persona,
                'polish',
                settings.selectedModel,
                getAiConfig(abortController.signal)
            );
            if (!abortController.signal.aborted) {
                setDraft(result);
                getRemainingQuota().then(setRemainingQuota);
                logBus('SidePanel', 'Background', 'LLM_REQUEST', { task: 'refine_draft' });
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') console.error("Refine failed", e);
        } finally {
            if (abortControllerRef.current === abortController) {
                setIsGenerating(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleTransferDraft = () => {
        if (!context.postData) return;
        onApplyDraft(context.postData.id, draft);
        setTransferStatus('success');
        logBus('SidePanel', 'ContentScript', 'UI_UPDATE', { action: 'fill_draft' });
    };

    const handleContextAction = (action: string) => {
        if (action === 'clone') handleAnalyzeStyle();
        if (action === 'summarize') handleVideoSummary();
        if (action === 'extract') handleExtractData();
        if (action === 'translate') handleExplainSelection('translate');
    };

    const handleChatSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() && !editingContent.trim()) return;

        // Handle editing existing message
        if (editingMessageId && editingContent.trim()) {
            const editedContent = editingContent.trim();
            setMessages(prev => prev.map(m =>
                m.id === editingMessageId
                    ? { ...m, content: editedContent }
                    : m
            ));
            setEditingMessageId(null);
            setEditingContent('');
            setChatInput('');
            return;
        }

        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: Date.now() }]);
        setIsChatting(true);

        // Create abort controller for cancellation
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Create streaming message
        const streamingId = Date.now().toString();
        setStreamingMessageId(streamingId);
        setMessages(prev => [...prev, {
            id: streamingId,
            role: 'assistant',
            content: '',
            timestamp: Date.now()
        }]);

        // Prepend Onboarding Context if needed
        let finalMsg = userMsg;
        if (!hasConfiguredAutoPilot) {
            finalMsg = `[ONBOARDING_CONFIG] ${userMsg}`;
        }

        try {
            let accumulatedContent = '';
            const response = await processUserIntentStream(
                finalMsg,
                personas,
                rules,
                settings.selectedModel,
                { ...getAiConfig(), signal: abortController.signal },
                { type: context.pageData?.type, url: context.pageData?.url, hasSelection: !!context.selection },
                messages,
                (chunk: string) => {
                    accumulatedContent += chunk;
                    setMessages(prev => prev.map(m =>
                        m.id === streamingId
                            ? { ...m, content: accumulatedContent }
                            : m
                    ));
                    // Auto scroll
                    setTimeout(() => {
                        if (chatBottomRef.current) {
                            chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 50);
                }
            );

            // Update final message with reasoning
            setMessages(prev => prev.map(m =>
                m.id === streamingId
                    ? { ...m, content: response.responseMessage, reasoning: response.reasoning }
                    : m
            ));

            if (response.operations && response.operations.length > 0) {
                onPerformOperations(response.operations);
                response.operations.forEach(op => {
                    if (op.type === 'trigger_action') {
                        if (op.payload.action === 'extract_data') handleExtractData();
                        if (op.payload.action === 'summarize_page') handleVideoSummary();
                        if (op.payload.action === 'translate_selection') handleExplainSelection('translate');
                        if (op.payload.action === 'delete_reply') {
                            handleDeleteReplyIntent(op.payload);
                        }
                    }
                });
            }
            getRemainingQuota().then(setRemainingQuota);
        } catch (e: any) {
            if (e.name === 'AbortError') {
                // User cancelled, remove streaming message
                setMessages(prev => prev.filter(m => m.id !== streamingId));
            } else {
                console.error(e);
                setMessages(prev => prev.map(m =>
                    m.id === streamingId
                        ? { ...m, content: `⚠️ ${e.message || 'Connection failed'}` }
                        : m
                ));
            }
        } finally {
            setIsChatting(false);
            setStreamingMessageId(null);
            abortControllerRef.current = null;
        }
    };

    const handleStopChat = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsChatting(false);
            setStreamingMessageId(null);
        }
    };

    const handleEditMessage = (messageId: string, content: string) => {
        setEditingMessageId(messageId);
        setEditingContent(content);
        setChatInput(content);
        // Scroll to input
        setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleCopyMessage = (content: string) => {
        navigator.clipboard.writeText(content);
        onAddSystemLog('User Action', 'Copied message to clipboard', 'User');
    };

    const handleRegenerateMessage = async (messageId: string) => {
        // Find the user message before this assistant message
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') return;

        // Find the previous user message
        let userMessage = '';
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                userMessage = messages[i].content;
                break;
            }
        }

        if (!userMessage) return;

        // Remove old message and regenerate
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setChatInput(userMessage);
        await handleChatSubmit();
    };

    // Handle delete reply intent from AI
    const handleDeleteReplyIntent = async (payload: any) => {
        if (!onDeleteReply || replyHistory.length === 0) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: settings.language === 'zh' ? '没有找到要删除的回复' : 'No reply found to delete',
                timestamp: Date.now()
            }]);
            return;
        }

        // Try to find the reply by various criteria
        let targetReply: ReplyHistory | null = null;

        if (payload.replyId) {
            targetReply = replyHistory.find(r => r.id === payload.replyId) || null;
        } else if (payload.targetAuthor) {
            // Find by author name (fuzzy match)
            const authorLower = payload.targetAuthor.toLowerCase();
            targetReply = replyHistory.find(r =>
                r.originalAuthor.toLowerCase().includes(authorLower) ||
                authorLower.includes(r.originalAuthor.toLowerCase())
            ) || null;
        } else if (payload.targetContent) {
            // Find by content (fuzzy match)
            const contentLower = payload.targetContent.toLowerCase();
            targetReply = replyHistory.find(r =>
                r.replyContent.toLowerCase().includes(contentLower) ||
                r.originalContent.toLowerCase().includes(contentLower)
            ) || null;
        } else {
            // Find the most recent reply
            targetReply = replyHistory[0] || null;
        }

        if (targetReply) {
            // Show processing message
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: settings.language === 'zh'
                    ? `正在删除给 ${targetReply!.originalAuthor} 的回复...`
                    : `Deleting reply to ${targetReply!.originalAuthor}...`,
                timestamp: Date.now()
            }]);

            // Call delete function which will send message to content script
            onDeleteReply(targetReply.id);

            // Show success message after a delay
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'system',
                    content: settings.language === 'zh'
                        ? `✓ 已删除给 ${targetReply!.originalAuthor} 的回复`
                        : `✓ Deleted reply to ${targetReply!.originalAuthor}`,
                    timestamp: Date.now()
                }]);
            }, 1000);
        } else {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                content: settings.language === 'zh'
                    ? '没有找到匹配的回复。您可以查看回复历史。'
                    : 'No matching reply found. You can check reply history.',
                timestamp: Date.now()
            }]);
        }
    };

    const handleAgentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agentInput.trim()) return;
        const intent = agentInput;
        setAgentInput('');
        setIsAgentPlanning(true);
        try {
            const elements = context.visibleElements || [];
            const actions = await planPageInteraction(intent, elements, settings.selectedModel, getAiConfig());
            if (actions.length > 0) onExecuteAgent(actions);
            else onAddSystemLog('AI Agent', 'Could not plan actions.', 'AI Agent');
            getRemainingQuota().then(setRemainingQuota);
        } catch (e) { console.error(e); } finally { setIsAgentPlanning(false); }
    };

    const handleAnalyzeStyle = async () => {
        if (!context.pageData) return;
        setIsGenerating(true);
        try {
            if (context.pageData.type === 'profile') {
                const result = await analyzeProfileStyle(context.pageData.content, settings.selectedModel, getAiConfig());
                setAnalyzedPersona(result);
            } else {
                const result = await analyzePostStyle(context.postData?.author || 'Unknown', context.pageData.content, settings.selectedModel, getAiConfig());
                setAnalyzedPersona(result);
            }
            getRemainingQuota().then(setRemainingQuota);
        } catch (e) { console.error(e); } finally { setIsGenerating(false); }
    };

    const handleExtractData = async () => {
        console.log('[Sidebar] handleExtractData called');
        setIsPageProcessing(true);
        try {
            let contentToAnalyze = context.pageData?.content;
            console.log('[Sidebar] Initial content from context:', contentToAnalyze ? 'has content' : 'no content');

            // 如果没有 pageData，尝试从 content script 请求
            if (!contentToAnalyze && typeof chrome !== 'undefined') {
                console.log('[Sidebar] Trying to get content from content script...');

                const pageContent = await new Promise<string>((resolve) => {
                    // 使用 background script 作为中转，发送消息到 content script
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({
                            type: 'FORWARD_TO_CONTENT',
                            payload: { type: 'REQUEST_PAGE_CONTEXT' }
                        }, (response: any) => {
                            if (chrome.runtime.lastError) {
                                console.warn('[Sidebar] Background forward failed:', chrome.runtime.lastError.message);
                                // 尝试直接使用 tabs API（如果可用）
                                if (chrome.tabs && chrome.tabs.query) {
                                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
                                        if (!tabs[0]?.id) {
                                            console.warn('[Sidebar] No active tab found');
                                            resolve('');
                                            return;
                                        }
                                        chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_PAGE_CONTEXT' }, (resp: any) => {
                                            if (chrome.runtime.lastError) {
                                                console.warn('[Sidebar] Direct tab message failed:', chrome.runtime.lastError.message);
                                                resolve('');
                                                return;
                                            }
                                            console.log('[Sidebar] Got response from content script:', !!resp);
                                            resolve(resp?.context?.mainContent || resp?.context?.summary || '');
                                        });
                                    });
                                } else {
                                    resolve('');
                                }
                                return;
                            }
                            console.log('[Sidebar] Got response via background:', !!response);
                            resolve(response?.context?.mainContent || response?.context?.summary || '');
                        });
                    } else {
                        console.warn('[Sidebar] chrome.runtime.sendMessage not available');
                        resolve('');
                    }
                });
                contentToAnalyze = pageContent;
            }

            if (!contentToAnalyze) {
                console.warn('[Sidebar] No content to analyze');
                setExtractData('⚠️ 无法获取页面内容。请刷新页面后重试。');
                return;
            }

            console.log('[Sidebar] Calling extractStructuredData with model:', settings.selectedModel);
            const config = getAiConfig();
            console.log('[Sidebar] AI Config:', {
                hasApiKey: !!config.apiKey,
                baseUrl: config.baseUrl,
                model: config.customModel
            });

            const json = await extractStructuredData(contentToAnalyze, settings.selectedModel, config);
            console.log('[Sidebar] Extract result:', typeof json === 'string' ? json.substring(0, 100) : json);
            setExtractData(json);
            getRemainingQuota().then(setRemainingQuota);
        } catch (e) {
            console.error('[Sidebar] Extract data error:', e);
            setExtractData(`❌ 错误: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setIsPageProcessing(false);
        }
    };

    const handleVideoSummary = async () => {
        if (!context.pageData) return;
        setIsPageProcessing(true);
        try {
            const summary = await summarizeVideoContent(context.pageData.content, settings.selectedModel, getAiConfig());
            setVideoSummary(summary);
            getRemainingQuota().then(setRemainingQuota);
        } catch (e) { console.error(e); } finally { setIsPageProcessing(false); }
    };

    const handleExplainSelection = async (mode: 'explain' | 'translate') => {
        if (!context.selection) return;
        setIsPageProcessing(true);
        try {
            const result = await explainSelection(context.selection, mode, settings.selectedModel, getAiConfig());
            setSelectionExplanation(result);
            if (result.length > 20) onAddMemory(`${mode === 'translate' ? 'Translation' : 'Explanation'}: ${result} (Source: ${context.selection})`);
            getRemainingQuota().then(setRemainingQuota);
        } catch (e) { console.error(e); } finally { setIsPageProcessing(false); }
    };

    const handleResetData = () => {
        if (confirm("Are you sure? This will wipe all data.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleExportData = () => {
        const data = { personas, rules, memories, settings };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `socialsage_backup.json`;
        a.click();
    };

    const handleImportData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (data.personas) data.personas.forEach((p: Persona) => onCreatePersona(p));
                    if (data.rules) data.rules.forEach((r: AutoRule) => onUpdateRule(r));
                    if (data.memories) data.memories.forEach((m: MemoryItem) => onAddMemory(m.content));
                    if (data.settings) onUpdateSettings({ ...settings, ...data.settings });
                    alert("Configuration Imported Successfully!");
                } catch (err) { alert("Failed to parse config file."); }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleTestConnection = async () => {
        setSaveStatus('saving');
        const config = getAiConfig();
        console.log('Testing connection with config:', config);
        const result = await testApiConnection(config);
        console.log('Test result:', result);
        if (result.success) alert(t('alert_conn_success'));
        else alert(`${t('alert_conn_fail')} ${result.message}`);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleApprovePost = (post: SocialPost) => {
        if (onUpdatePost) {
            onUpdatePost({ ...post, isAutoReplied: true, reviewStatus: 'approved' });
            onAddSystemLog('Auto-Pilot', `Approved reply to ${post.author}.`, 'User');
        }
    };

    const handleRejectPost = (post: SocialPost) => {
        if (onUpdatePost) {
            onUpdatePost({ ...post, reviewStatus: 'rejected', isSkipped: true, replyDraft: undefined });
            onAddSystemLog('Auto-Pilot', `Rejected reply to ${post.author}.`, 'User');
        }
    };

    const isTransferReady = context.status === 'replying' && !!draft && !isGenerating;

    // --- RENDER ---
    return (
        <div className="h-full flex flex-col bg-white border-l border-slate-200 text-slate-800">

            {/* Header */}
            <div className="shrink-0 bg-white border-b border-slate-100 p-3 pb-0 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="bg-indigo-600 w-6 h-6 rounded-lg flex items-center justify-center">
                            <SparklesIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm text-slate-900 leading-none">SocialSage</h1>
                            <div className="flex items-center mt-0.5 space-x-2">
                                <div className="flex items-center space-x-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isAutoPilot ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                        {isAutoPilot ? t('status_working') : t('status_active')}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-0.5 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                    <ShieldIcon className="w-2.5 h-2.5" />
                                    <span>{t('status_secure')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={onToggleAutoPilot}
                            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase transition-all shadow-sm group
                        ${isAutoPilot
                                    ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-red-600 hover:border-red-600'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-500 hover:text-indigo-600'}`}
                        >
                            <RobotIcon className="w-3 h-3" />
                            <span>{isAutoPilot ? t('btn_stop_auto') : t('btn_start_auto')}</span>
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`p-1.5 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-slate-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><SettingsIcon className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="flex space-x-1 overflow-x-auto no-scrollbar pb-0">
                    <TabBtn id="context" icon={<ZapIcon />} label={t('nav_assist')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="chat" icon={<MessageSquareIcon />} label={t('nav_chat')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="drafts" icon={<FileTextIcon />} label={t('nav_drafts')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="rules" icon={<ListPlusIcon />} label={t('nav_rules')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="personas" icon={<UsersIcon />} label={t('nav_personas')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="stats" icon={<BarChartIcon />} label={t('nav_stats')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="memory" icon={<BrainIcon />} label={t('nav_memory')} active={activeTab} onClick={setActiveTab} />
                    <TabBtn id="logs" icon={<TerminalIcon />} label={t('nav_logs')} active={activeTab} onClick={setActiveTab} />
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50/50 relative">

                {/* TAB: CHAT (Refactored) */}
                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col">
                        {/* Messages Area */}
                        {messages.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
                                    <RobotIcon className="w-8 h-8 text-indigo-500" />
                                </div>
                                <p className="text-slate-500 font-medium text-center text-sm">{t('msg_welcome_chat')}</p>

                                {/* Centered Input Form for Empty State */}
                                <div className="w-full max-w-sm space-y-3">
                                    <ContextActions context={context} onAction={handleContextAction} t={t} />
                                    <form onSubmit={handleChatSubmit} className="relative shadow-lg rounded-xl overflow-hidden border border-indigo-100 bg-white group focus-within:ring-2 ring-indigo-500/20 transition-all">
                                        <textarea
                                            ref={textareaRef}
                                            className="w-full p-4 pr-12 text-sm outline-none resize-none max-h-32 min-h-[80px] text-slate-700 placeholder-slate-400 bg-transparent"
                                            placeholder={t('placeholder_chat')}
                                            rows={3}
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                                        />
                                        <button type="submit" disabled={!chatInput.trim() || isChatting} className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                                            <SendIcon className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map(m => (
                                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                                        {m.role === 'system' ? (
                                            <div className="w-full flex justify-center my-2">
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-full italic border border-slate-200">
                                                    {m.content}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm animate-in slide-in-from-bottom-2 duration-300 relative ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                                {/* Action buttons - show on hover for assistant messages */}
                                                {m.role === 'assistant' && (
                                                    <div className="absolute -top-8 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg border border-slate-200 p-1">
                                                        <button
                                                            onClick={() => handleEditMessage(m.id, m.content)}
                                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                                                            title="编辑"
                                                        >
                                                            <EditIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleCopyMessage(m.content)}
                                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                                                            title="复制"
                                                        >
                                                            <CopyIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRegenerateMessage(m.id)}
                                                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                                                            title="重新生成"
                                                        >
                                                            <RefreshIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}

                                                {m.reasoning && (
                                                    <details className="mb-2 group">
                                                        <summary className="text-[10px] font-bold text-slate-400 cursor-pointer uppercase tracking-wider flex items-center gap-1 list-none select-none">
                                                            <BrainIcon className="w-3 h-3" />
                                                            <span>{t('lbl_thinking')}</span>
                                                            <ChevronDownIcon className="w-3 h-3 transition-transform group-open:rotate-180" />
                                                        </summary>
                                                        <div className="mt-1 p-2 bg-slate-50 rounded text-xs text-slate-500 italic border border-slate-100">
                                                            {m.reasoning}
                                                        </div>
                                                    </details>
                                                )}
                                                <p className="whitespace-pre-wrap leading-relaxed">
                                                    {m.content}
                                                    {streamingMessageId === m.id && (
                                                        <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse"></span>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isChatting && streamingMessageId === null && (
                                    <div className="flex justify-start animate-pulse">
                                        <div className="bg-slate-200 h-8 w-12 rounded-2xl rounded-bl-none flex items-center justify-center space-x-1">
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatBottomRef} />
                            </div>
                        )}

                        {/* Input Form (Fixed at Bottom if messages exist) */}
                        {messages.length > 0 && (
                            <div className="p-3 bg-white border-t border-slate-200 space-y-2">
                                {/* Auto-Reply Mode Toggle (Only when Auto-Reply is ON) */}
                                {isAutoPilot && (
                                    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <RobotIcon className="w-4 h-4 text-indigo-600" />
                                            <span className="text-xs font-semibold text-indigo-900">{t('auto_reply_mode')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-indigo-200">
                                            <button
                                                onClick={() => onUpdateSettings({ ...settings, autoReplyMode: 'automatic' })}
                                                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${settings.autoReplyMode === 'automatic'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {t('mode_auto_label')}
                                            </button>
                                            <button
                                                onClick={() => onUpdateSettings({ ...settings, autoReplyMode: 'review' })}
                                                className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${settings.autoReplyMode === 'review'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {t('mode_review_label')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Auto-Reply Preview (When generating reply) */}
                                {isAutoPilot && context.autoPilotStatus && context.autoPilotStatus !== 'idle' && context.postData && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                <span className="text-xs font-semibold text-blue-900">
                                                    {context.autoPilotStatus === 'scanning' ? t('think_scanning') :
                                                        context.autoPilotStatus === 'analyzing' ? t('think_analyzing') :
                                                            context.autoPilotStatus === 'writing' ? t('generating_reply') :
                                                                context.autoPilotStatus === 'review_wait' ? t('waiting_review') :
                                                                    t('msg_crafting')}
                                                </span>
                                            </div>
                                            {context.postData && (
                                                <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                                    {context.postData.author}
                                                </span>
                                            )}
                                        </div>
                                        {context.postData.replyDraft && (
                                            <div className="bg-white rounded border border-blue-100 p-2">
                                                <div className="text-[10px] text-slate-500 mb-1">
                                                    {settings.language === 'zh' ? '生成的回复：' : 'Generated Reply:'}
                                                </div>
                                                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                    {context.postData.replyDraft}
                                                </div>
                                                {settings.autoReplyMode === 'review' && (
                                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-100">
                                                        <button
                                                            onClick={() => {
                                                                if (onUpdatePost && context.postData) {
                                                                    onUpdatePost({
                                                                        ...context.postData,
                                                                        isAutoReplied: true,
                                                                        reviewStatus: 'approved'
                                                                    });
                                                                    onAddSystemLog('Auto-Pilot',
                                                                        settings.language === 'zh'
                                                                            ? `已确认回复给 ${context.postData.author}`
                                                                            : `Approved reply to ${context.postData.author}`,
                                                                        'User');
                                                                }
                                                            }}
                                                            className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors"
                                                        >
                                                            {t('confirm_send')} ✓
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (onUpdatePost && context.postData) {
                                                                    onUpdatePost({
                                                                        ...context.postData,
                                                                        reviewStatus: 'rejected',
                                                                        isSkipped: true,
                                                                        replyDraft: undefined
                                                                    });
                                                                    onAddSystemLog('Auto-Pilot',
                                                                        settings.language === 'zh'
                                                                            ? `已拒绝回复给 ${context.postData.author}`
                                                                            : `Rejected reply to ${context.postData.author}`,
                                                                        'User');
                                                                }
                                                            }}
                                                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
                                                        >
                                                            {t('reject_reply')} ✗
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <ContextActions context={context} onAction={handleContextAction} t={t} />
                                {editingMessageId && (
                                    <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
                                        <span>正在编辑消息...</span>
                                        <button
                                            onClick={() => {
                                                setEditingMessageId(null);
                                                setEditingContent('');
                                                setChatInput('');
                                            }}
                                            className="text-yellow-600 hover:text-yellow-800"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <form onSubmit={handleChatSubmit} className="relative group rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:ring-2 ring-indigo-500/20 transition-all">
                                    <textarea
                                        ref={textareaRef}
                                        className="w-full p-3 pr-20 text-sm outline-none resize-none max-h-32 min-h-[80px] text-slate-700 bg-transparent placeholder-slate-400"
                                        placeholder={editingMessageId ? "编辑消息..." : t('placeholder_chat')}
                                        rows={3}
                                        value={editingMessageId ? editingContent : chatInput}
                                        onChange={e => {
                                            if (editingMessageId) {
                                                setEditingContent(e.target.value);
                                            } else {
                                                setChatInput(e.target.value);
                                            }
                                        }}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleChatSubmit();
                                            }
                                            if (e.key === 'Escape' && editingMessageId) {
                                                setEditingMessageId(null);
                                                setEditingContent('');
                                                setChatInput('');
                                            }
                                        }}
                                    />
                                    <div className="absolute right-2 bottom-2 flex items-center gap-1">
                                        {isChatting && (
                                            <button
                                                type="button"
                                                onClick={handleStopChat}
                                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                                                title="停止生成"
                                            >
                                                <StopIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={(!chatInput.trim() && !editingContent.trim()) || (isChatting && !editingMessageId)}
                                            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                                        >
                                            {editingMessageId ? (
                                                <CheckIcon className="w-4 h-4" />
                                            ) : (
                                                <SendIcon className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: QUEUE (Review Mode) */}
                {activeTab === 'queue' && (
                    <div className="h-full overflow-y-auto p-4 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">{t('queue_title')}</h2>
                        {posts.filter(p => p.reviewStatus === 'pending').length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                                <ClockIcon className="w-12 h-12 opacity-20" />
                                <p className="text-sm font-medium">{t('queue_empty')}</p>
                            </div>
                        ) : (
                            posts.filter(p => p.reviewStatus === 'pending').map(post => {
                                const persona = personas.find(pId => pId.id === post.usedPersonaId);
                                return (
                                    <div key={post.id} className="bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                        <div className="bg-yellow-50 p-3 border-b border-yellow-100 flex justify-between items-center">
                                            <span className="text-xs font-bold text-yellow-800 uppercase tracking-wide">Reply to {post.author}</span>
                                            {persona && <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-yellow-200 text-slate-500">{persona.name}</span>}
                                        </div>
                                        <div className="p-3">
                                            <div className="text-xs text-slate-500 italic mb-2 pl-2 border-l-2 border-slate-200 line-clamp-2">
                                                "{post.content}"
                                            </div>
                                            <textarea
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:ring-2 focus:ring-yellow-500/20 outline-none"
                                                rows={3}
                                                defaultValue={post.replyDraft}
                                            />
                                        </div>
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex space-x-2 justify-end">
                                            <button onClick={() => handleRejectPost(post)} className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors">
                                                {t('btn_reject')}
                                            </button>
                                            <button onClick={() => handleApprovePost(post)} className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded shadow-sm transition-colors">
                                                {t('btn_approve')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* TAB: ASSIST (Context) */}
                {activeTab === 'context' && (
                    <div className="h-full overflow-y-auto p-4 space-y-6">
                        {/* Page Context Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {context.postData ? t('card_target_post') : t('card_current_page')}
                                </span>
                                {context.postData && (
                                    <button onClick={handleAnalyzeStyle} disabled={isGenerating} className="text-[10px] flex items-center text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors font-bold">
                                        <UserPlusIcon className="w-3 h-3 mr-1" /> {t('btn_clone')}
                                    </button>
                                )}
                            </div>
                            <div className="p-3">
                                {context.postData ? (
                                    <div className="space-y-2">
                                        <p className="text-sm text-slate-700 italic line-clamp-3">"{context.postData.content}"</p>
                                        <button
                                            onClick={handleExtractData}
                                            disabled={isPageProcessing}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs font-bold transition-colors"
                                        >
                                            {isPageProcessing ? '处理中...' : t('btn_extract')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-500 truncate">{context.pageData?.url || '正在加载页面信息...'}</p>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={handleExtractData}
                                                disabled={isPageProcessing}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded text-xs font-bold transition-colors"
                                            >
                                                {isPageProcessing ? '处理中...' : t('btn_extract')}
                                            </button>
                                            {context.pageData?.type === 'video' && (
                                                <button onClick={handleVideoSummary} disabled={isPageProcessing} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded text-xs font-bold transition-colors">
                                                    {t('btn_summarize')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Analysis Results */}
                            {analyzedPersona && (
                                <div className="px-3 pb-3 animate-in slide-in-from-top-2">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase">{t('card_detected_persona')}</span>
                                            <button onClick={() => onCreatePersona({ id: Date.now().toString(), name: analyzedPersona.name!, description: analyzedPersona.description!, tone: analyzedPersona.tone!, exampleText: analyzedPersona.exampleText! })} className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">{t('lbl_save')}</button>
                                        </div>
                                        <p className="text-xs font-bold text-indigo-900 mt-1">{analyzedPersona.name} <span className="font-normal text-indigo-600">({analyzedPersona.tone})</span></p>
                                    </div>
                                </div>
                            )}

                            {/* Extracted Data Results */}
                            {extractedData && (
                                <div className="px-3 pb-3 animate-in slide-in-from-top-2">
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-emerald-500 uppercase">📊 提取结果</span>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(extractedData);
                                                }}
                                                className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded hover:bg-emerald-700"
                                            >
                                                复制
                                            </button>
                                        </div>
                                        <pre className="text-xs text-emerald-900 whitespace-pre-wrap font-mono bg-white/50 rounded p-2 max-h-48 overflow-auto">
                                            {typeof extractedData === 'string' ? extractedData : JSON.stringify(extractedData, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* PAGE INSPECTOR (NEW) - Shows captured Context */}
                        {context.capturedContext && !context.postData && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('card_page_inspector')}</span>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <span className="text-[9px] font-mono text-slate-400">LIVE</span>
                                    </div>
                                </div>
                                <div className="p-3 space-y-3">
                                    {/* Metadata */}
                                    <div className="bg-slate-50 rounded p-2 border border-slate-100">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">METADATA</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="truncate"><span className="text-slate-500">Title:</span> {context.capturedContext.metadata.title}</div>
                                            <div className="truncate"><span className="text-slate-500">Lang:</span> {context.capturedContext.metadata.language}</div>
                                            <div className="truncate col-span-2"><span className="text-slate-500">Desc:</span> {context.capturedContext.metadata.description}</div>
                                        </div>
                                    </div>

                                    {/* DOM Tree Visualizer (Simplified) */}
                                    <div className="bg-[#1e1e1e] rounded p-3 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto shadow-inner">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-700 pb-1">COMPRESSED DOM SNAPSHOT</div>
                                        {context.capturedContext.domTree.map((node, i) => (
                                            <div key={i} className="whitespace-pre">
                                                <span className="text-blue-400">&lt;{node.tag}</span>
                                                {node.classes && node.classes.length > 0 && <span className="text-yellow-400"> class="{node.classes.join(' ')}"</span>}
                                                <span className="text-blue-400">&gt;</span>
                                                {node.children && node.children.map((child, j) => (
                                                    <div key={j} className="pl-4 border-l border-slate-700 ml-1 hover:bg-white/5">
                                                        <span className="text-blue-400">&lt;{child.tag}</span>
                                                        {child.classes && child.classes.length > 0 && <span className="text-yellow-400"> class="{child.classes[0]}..."</span>}
                                                        <span className="text-blue-400">&gt;</span>
                                                        {child.text && <span className="text-white"> {child.text.substring(0, 30)}...</span>}
                                                        {child.children && <span className="text-slate-500"> ...({child.children.length})</span>}
                                                        <span className="text-blue-400">&lt;/{child.tag}&gt;</span>
                                                    </div>
                                                ))}
                                                <div className="text-blue-400">&lt;/{node.tag}&gt;</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Draft Assistant */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ring-1 ring-slate-100">
                            {/* Quick Actions */}
                            {context.postData && (
                                <div className="p-2 bg-slate-50 border-b border-slate-100">
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('card_quick_draft')}</span>
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded">{t('lbl_auto_detect')}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {INTENT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => handleAutoDraft(context.postData!, opt.id)}
                                                disabled={isGenerating}
                                                className={`py-1.5 rounded border text-xs font-medium transition-all active:scale-95
                                            ${lastIntent === opt.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Draft Input Area */}
                            <div className="relative group">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 transition-opacity group-focus-within:opacity-100"></div>

                                {/* Draft Header */}
                                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/30 border-b border-indigo-100/50">
                                    <div className="flex items-center space-x-2">
                                        <SparklesIcon className="w-3 h-3 text-indigo-500" />
                                        <span className="text-xs font-bold text-indigo-900">{t('card_ai_draft')}</span>
                                        {usedMemoryForDraft && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full flex items-center" title={usedMemoryForDraft.content}>
                                                <BrainIcon className="w-2 h-2 mr-1" /> Context
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={handleRefineDraft}
                                            className="flex items-center space-x-1 px-2 py-1 bg-white border border-indigo-200 rounded text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Smart Polish: Improve grammar while maintaining Persona tone"
                                        >
                                            <MagicIcon className="w-3 h-3" />
                                            <span>{t('btn_refine')}</span>
                                        </button>
                                        {lastIntent && (
                                            <button onClick={() => context.postData && handleAutoDraft(context.postData, lastIntent)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Regenerate">
                                                <RefreshIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button onClick={() => navigator.clipboard.writeText(draft)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="Copy">
                                            <CopyIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {isGenerating ? (
                                    <div className="h-32 flex flex-col items-center justify-center text-indigo-600 space-y-2 bg-white">
                                        <SparklesIcon className="w-6 h-6 animate-spin" />
                                        <span className="text-xs font-bold animate-pulse">{t('msg_crafting')}</span>
                                        <button
                                            onClick={handleStopGeneration}
                                            className="flex items-center space-x-1 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold hover:bg-red-100 mt-2"
                                        >
                                            <StopIcon className="w-3 h-3" />
                                            <span>{t('btn_stop_edit')}</span>
                                        </button>
                                    </div>
                                ) : (
                                    <textarea
                                        className="w-full h-32 p-3 text-sm text-slate-700 resize-none outline-none bg-white"
                                        placeholder={t('placeholder_draft')}
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                    />
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end items-center space-x-2">
                                {transferStatus === 'success' ? (
                                    <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm flex items-center cursor-default">
                                        <CheckIcon className="w-3 h-3 mr-1.5" /> {t('btn_protected')}
                                    </button>
                                ) : (
                                    <>
                                        {!context.postData && (
                                            <span className="text-[10px] text-orange-500 mr-auto font-medium flex items-center">
                                                {t('msg_open_reply')}
                                            </span>
                                        )}
                                        <button
                                            onClick={handleTransferDraft}
                                            disabled={!isTransferReady}
                                            className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all active:scale-95"
                                            title={!context.postData ? "Open a reply box in the browser first" : "Simulate human typing"}
                                        >
                                            <ShieldIcon className="w-3 h-3 mr-1.5" /> {t('btn_transfer')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: DRAFTS (Content Generator) */}
                {activeTab === 'drafts' && (
                    <div className="h-full p-4 overflow-hidden">
                        <PostGenerator
                            personas={personas}
                            onUseDraft={(content) => { setDraft(content); setActiveTab('context'); }}
                            apiKey={settings.apiKey}
                            aiConfig={getAiConfig()}
                            language={settings.language}
                        />
                    </div>
                )}

                {/* TAB: STATS (Dashboard) */}
                {activeTab === 'stats' && (
                    <div className="h-full p-4 overflow-y-auto space-y-4">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">{t('stats_time_saved')}</div>
                                <div className="text-2xl font-bold text-indigo-600">{(context.sessionStats?.repliesCount || 0 * 2.5).toFixed(1)}m</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-slate-400 text-xs font-bold uppercase mb-1">{t('stats_posts_replied')}</div>
                                <div className="text-2xl font-bold text-slate-800">{context.sessionStats?.repliesCount || 0}</div>
                            </div>
                        </div>

                        {/* Safety Score */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-slate-400 text-xs font-bold uppercase">{t('stats_safety')}</div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${settings.autoPilotSpeed === 'slow' ? 'bg-green-100 text-green-700' :
                                    settings.autoPilotSpeed === 'human' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {settings.autoPilotSpeed === 'slow' ? '99%' : settings.autoPilotSpeed === 'human' ? '88%' : '45%'}
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${settings.autoPilotSpeed === 'slow' ? 'bg-green-500 w-[99%]' :
                                        settings.autoPilotSpeed === 'human' ? 'bg-yellow-500 w-[88%]' :
                                            'bg-red-500 w-[45%]'
                                        }`}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">
                                {settings.autoPilotSpeed === 'fast'
                                    ? t('msg_high_risk')
                                    : settings.autoPilotSpeed === 'slow' ? t('msg_stealth') : t('msg_balanced')}
                            </p>
                        </div>
                    </div>
                )}

                {/* TAB: RULES */}
                {activeTab === 'rules' && (
                    <div className="h-full overflow-y-auto p-4">
                        <RuleBuilder
                            rules={rules}
                            personas={personas}
                            onUpdateRule={onUpdateRule}
                            onDeleteRule={onDeleteRule}
                            language={settings.language}
                        />
                    </div>
                )}

                {/* TAB: PERSONAS */}
                {activeTab === 'personas' && (
                    <div className="h-full overflow-y-auto p-4">
                        <PersonaManager
                            personas={personas}
                            defaultPersonaId={defaultPersonaId}
                            onCreate={onCreatePersona}
                            onUpdate={onUpdatePersona}
                            onDelete={onDeletePersona}
                            onSetDefault={onSetDefaultPersona}
                            language={settings.language}
                        />
                    </div>
                )}

                {/* TAB: MEMORY */}
                {activeTab === 'memory' && (
                    <div className="h-full overflow-y-auto p-4 space-y-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h2 className="font-bold text-slate-800 mb-2">{t('mem_kb')}</h2>
                            <div className="flex space-x-2 mb-4">
                                <input
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500"
                                    placeholder={t('mem_placeholder')}
                                    value={memoryInput}
                                    onChange={e => setMemoryInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && memoryInput) { onAddMemory(memoryInput); setMemoryInput(''); } }}
                                />
                                <button onClick={() => { if (memoryInput) { onAddMemory(memoryInput); setMemoryInput(''); } }} className="bg-slate-900 text-white px-3 rounded-lg font-bold text-xs">{t('mem_add')}</button>
                            </div>
                            <div className="space-y-2">
                                {memories.map(m => (
                                    <div key={m.id} className="group bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs relative hover:border-indigo-200 transition-colors">
                                        <p className="text-slate-700 pr-6 leading-relaxed">{m.content}</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">{new Date(m.timestamp).toLocaleDateString()} • {m.source}</span>
                                        <button onClick={() => onDeleteMemory(m.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {memories.length === 0 && <p className="text-center text-slate-400 text-xs py-4">{t('mem_empty')}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: LOGS */}
                {activeTab === 'logs' && (
                    <div className="h-full overflow-y-auto bg-slate-900 p-4 font-mono text-[10px] text-slate-300">
                        {busMessages.map(msg => (
                            <div key={msg.id} className="mb-2 border-l-2 border-slate-700 pl-2">
                                <span className="text-indigo-400">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                <span className="text-slate-500 mx-2">[{msg.from} &rarr; {msg.to}]</span>
                                <span className="text-green-400 font-bold">{msg.type}</span>
                                <div className="text-slate-400 mt-0.5 whitespace-pre-wrap break-all">
                                    {JSON.stringify(msg.payload)}
                                </div>
                            </div>
                        ))}
                        <div ref={busBottomRef} />
                    </div>
                )}

                {/* TAB: SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="h-full overflow-y-auto p-4 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 relative">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">{t('settings_title')}</h2>
                                    <p className="text-xs text-slate-500">{t('settings_desc')}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {/* Save Status Indicator */}
                                    {saveStatus !== 'idle' && (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded bg-slate-100 flex items-center ${saveStatus === 'saved' ? 'text-green-600' : 'text-slate-400'}`}>
                                            {saveStatus === 'saving' ? 'Saving...' : 'Saved ✓'}
                                        </span>
                                    )}
                                    <button onClick={handleResetData} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors" title={t('btn_reset')}>
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Model Provider */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t('settings_model')}</label>
                                <select
                                    className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-indigo-500"
                                    value={settings.selectedModel}
                                    onChange={e => onUpdateSettings({ ...settings, selectedModel: e.target.value as any })}
                                >
                                    <option value="gemini-2.5-flash">{t('model_flash')}</option>
                                    <option value="gemini-2.5-pro">{t('model_pro')}</option>
                                    <option value="gemini-3.0-pro-preview">{t('model_next')}</option>
                                    <option value="deepseek-chat">{t('model_ds_chat')}</option>
                                    <option value="deepseek-reasoner">{t('model_ds_reasoner')}</option>
                                    <option value="custom">{t('model_custom')}</option>
                                </select>
                            </div>

                            {/* Dynamic Inputs based on Provider */}
                            {(settings.selectedModel === 'custom' || settings.selectedModel.startsWith('deepseek')) ? (
                                <div className="space-y-3 pl-3 border-l-2 border-slate-100 animate-in fade-in">
                                    {/* Quick Presets */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="text-[10px] text-slate-400 w-full">快速配置:</span>
                                        {/* Packy API - 你的预设服务 */}
                                        <button
                                            onClick={() => onUpdateSettings({
                                                ...settings,
                                                customBaseUrl: 'https://www.packyapi.com/v1',
                                                customModelName: settings.selectedModel.startsWith('deepseek')
                                                    ? settings.selectedModel
                                                    : 'deepseek-chat'
                                            })}
                                            className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 font-bold"
                                        >
                                            📦 PackyAPI
                                        </button>
                                        {/* DeepSeek Official */}
                                        <button
                                            onClick={() => onUpdateSettings({
                                                ...settings,
                                                customBaseUrl: 'https://api.deepseek.com/v1',
                                                customModelName: settings.selectedModel.startsWith('deepseek')
                                                    ? settings.selectedModel
                                                    : 'deepseek-chat'
                                            })}
                                            className="text-[10px] px-2 py-1 bg-slate-100 rounded hover:bg-slate-200"
                                        >
                                            DeepSeek
                                        </button>
                                        {settings.selectedModel === 'custom' && (
                                            <>
                                                <button onClick={() => onUpdateSettings({ ...settings, customBaseUrl: 'https://api.moonshot.cn/v1', customModelName: 'moonshot-v1-8k' })} className="text-[10px] px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Kimi</button>
                                                <button onClick={() => onUpdateSettings({ ...settings, customBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', customModelName: 'qwen-max' })} className="text-[10px] px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Qwen</button>
                                                <button onClick={() => onUpdateSettings({ ...settings, customBaseUrl: 'https://api.lingyiwanwu.com/v1', customModelName: 'yi-large' })} className="text-[10px] px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Yi</button>
                                            </>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">API Base URL</label>
                                        <input
                                            type="text"
                                            className="w-full text-xs p-2 border border-slate-200 rounded bg-slate-50 font-mono"
                                            placeholder="https://api.openai.com/v1"
                                            value={settings.customBaseUrl || (settings.selectedModel.startsWith('deepseek') ? 'https://www.packyapi.com/v1' : '')}
                                            onChange={e => onUpdateSettings({ ...settings, customBaseUrl: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">API Key (Bearer)</label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="password"
                                                className="flex-1 text-xs p-2 border border-slate-200 rounded bg-slate-50 font-mono"
                                                placeholder="sk-..."
                                                value={settings.customApiKey || ''}
                                                onChange={e => onUpdateSettings({ ...settings, customApiKey: e.target.value })}
                                            />
                                            <button onClick={handleTestConnection} className="bg-slate-800 text-white px-3 rounded text-xs font-bold hover:bg-slate-700">{t('btn_test')}</button>
                                        </div>
                                    </div>
                                    {settings.selectedModel === 'custom' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model Name</label>
                                            <input
                                                type="text"
                                                className="w-full text-xs p-2 border border-slate-200 rounded bg-slate-50 font-mono"
                                                placeholder="gpt-4o"
                                                value={settings.customModelName || ''}
                                                onChange={e => onUpdateSettings({ ...settings, customModelName: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Google Models */
                                <div className="animate-in fade-in">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t('settings_api_key')}</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="password"
                                            className="flex-1 text-sm p-2 border border-slate-200 rounded-lg bg-slate-50 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="AIza..."
                                            value={settings.apiKey}
                                            onChange={e => onUpdateSettings({ ...settings, apiKey: e.target.value })}
                                        />
                                        <button onClick={handleTestConnection} className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-slate-700">{t('btn_test')}</button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Leave empty to use trial quota (Flash only). Required for Pro models.
                                    </p>
                                </div>
                            )}

                            {/* Language Settings */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t('settings_language')}</label>
                                    <select
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                                        value={settings.language}
                                        onChange={e => onUpdateSettings({ ...settings, language: e.target.value as any })}
                                    >
                                        <option value="en">English</option>
                                        <option value="zh">简体中文 (Chinese)</option>
                                        <option value="ja">日本語 (Japanese)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">{t('settings_output_lang')}</label>
                                    <select
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
                                        value={settings.outputLanguage || 'same'}
                                        onChange={e => onUpdateSettings({ ...settings, outputLanguage: e.target.value })}
                                    >
                                        <option value="same">Same as Interface</option>
                                        <option value="en">English</option>
                                        <option value="zh">Chinese (Simplified)</option>
                                        <option value="ja">Japanese</option>
                                        <option value="es">Spanish</option>
                                    </select>
                                </div>
                            </div>

                            {/* Auto-Reply Mode (NEW) */}
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">{t('settings_mode')}</label>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onUpdateSettings({ ...settings, autoReplyMode: 'automatic' })}
                                        className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${settings.autoReplyMode === 'automatic' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        {t('mode_auto_label')}
                                    </button>
                                    <button
                                        onClick={() => onUpdateSettings({ ...settings, autoReplyMode: 'review' })}
                                        className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${settings.autoReplyMode === 'review' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        {t('mode_review_label')}
                                    </button>
                                </div>
                            </div>

                            {/* Speed Setting */}
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">{t('settings_speed')}</label>
                                <div className="flex space-x-2">
                                    {[
                                        { id: 'fast', label: t('speed_fast_label') },
                                        { id: 'human', label: t('speed_human_label') },
                                        { id: 'slow', label: t('speed_slow_label') }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => onUpdateSettings({ ...settings, autoPilotSpeed: opt.id as any })}
                                            className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${settings.autoPilotSpeed === opt.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {settings.autoPilotSpeed === 'fast' ? t('msg_high_risk') : settings.autoPilotSpeed === 'slow' ? t('msg_stealth') : t('msg_balanced')}
                                </p>
                            </div>

                            {/* Data Management */}
                            <div className="flex justify-between pt-4 border-t border-slate-100">
                                <button onClick={handleExportData} className="text-xs text-indigo-600 font-bold hover:underline bg-white border border-indigo-100 px-3 py-2 rounded">{t('btn_backup')}</button>
                                <button onClick={handleImportData} className="text-xs text-indigo-600 font-bold hover:underline bg-white border border-indigo-100 px-3 py-2 rounded">{t('btn_import')}</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

const TabBtn = ({ id, icon, label, active, onClick, badge }: any) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg text-[10px] font-bold uppercase tracking-wide transition-colors border-t border-x whitespace-nowrap shrink-0 relative
        ${active === id
                ? 'bg-slate-50/50 border-slate-200 border-b-transparent text-indigo-600'
                : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
    >
        {React.cloneElement(icon, { className: `w-3 h-3 ${active === id ? 'text-indigo-500' : ''}` })}
        <span>{label}</span>
        {badge > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                {badge}
            </span>
        )}
    </button>
);

export default ExtensionSidebar;