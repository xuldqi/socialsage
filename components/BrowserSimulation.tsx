










import React, { useState, useEffect, useRef } from 'react';
import { SocialPost, ExtensionContext, PageData, PageType, Platform, SemanticElement, AgentAction, UserSettings } from '../types';
import { SendIcon, RefreshIcon, VideoIcon, FileTextIcon, UsersIcon, GlobeIcon, SearchIcon, TableIcon, MailIcon, SparklesIcon, BookmarkIcon, ImageIcon, RobotIcon, ShieldIcon, CheckIcon, TerminalIcon } from './Icons';
import { scanPage } from '../services/pageExtractor'; // IMPORTING REAL EXTRACTOR

interface BrowserSimulationProps {
  posts: SocialPost[]; // For social feed mode
  activeContextId?: string;
  onContextChange: React.Dispatch<React.SetStateAction<ExtensionContext>>;
  onUpdatePost: (post: SocialPost) => void;
  onSaveToMemory?: (text: string) => void;
  pendingActions?: AgentAction[]; // Actions sent from Sidebar to be executed here
  onActionComplete?: () => void;
  onLearnStyle?: (postId: string, newText: string) => void;
  settings?: UserSettings; // Pass settings to control simulation speed
  agentThinking?: string; // New prop for visualization
}

const TRANSLATIONS: Record<string, any> = {
    en: {
        agent_active: "Agent Active: Analyzing...",
        scanning: "Scanning Feed...",
        safe_typing: "Safe Typing...",
        replied: "REPLIED",
        skipped: "SKIPPED",
        review_pending: "REVIEW",
        for_you: "For You",
        following: "Following",
        reply_to: "Replying to",
        toolbar_profile: "Profile",
        placeholder_reply: "Post your reply",
        placeholder_comment: "Write a comment...",
        placeholder_email: "Type your reply...",
        btn_reply: "Reply",
        btn_post: "Post",
        btn_send: "Send",
        lbl_to: "To",
        lbl_subject: "Subject",
        mock_fb_mind: "What's on your mind?",
        mock_email_title: "Project Collaboration Request",
        mock_email_body: "Subject: Collaboration\nFrom: John Doe\n\nHi there, I'd love to discuss a partnership opportunity...",
        mock_reddit_karma: "Karma",
        mock_reddit_joined: "Joined",
        mock_reddit_posted_by: "Posted by",
        mock_web_sim: "Web Page Simulation",
        action_explain: "Explain",
        action_translate: "Translate",
        action_save: "Save to Memory",
        intent_agree: "Agree",
        intent_disagree: "Disagree",
        intent_humor: "Humorous",
        intent_question: "Question",
        hud_title: "AGENT ACTIVITY"
    },
    zh: {
        agent_active: "Agent 运行中：分析中...",
        scanning: "正在扫描信息流...",
        safe_typing: "安全输入中...",
        replied: "已回复",
        skipped: "已跳过",
        review_pending: "待审核",
        for_you: "推荐",
        following: "关注",
        reply_to: "回复给",
        toolbar_profile: "个人资料",
        placeholder_reply: "发布你的回复",
        placeholder_comment: "写下你的评论...",
        placeholder_email: "输入回复内容...",
        btn_reply: "回复",
        btn_post: "发布",
        btn_send: "发送",
        lbl_to: "收件人",
        lbl_subject: "主题",
        mock_fb_mind: "分享你的新鲜事...",
        mock_email_title: "项目合作请求",
        mock_email_body: "主题: 商务合作\n来自: John Doe\n\n您好，希望能与您探讨合作机会...",
        mock_reddit_karma: "Karma值",
        mock_reddit_joined: "加入于",
        mock_reddit_posted_by: "发布者",
        mock_web_sim: "网页模拟",
        action_explain: "解释",
        action_translate: "翻译",
        action_save: "保存到记忆",
        intent_agree: "同意",
        intent_disagree: "反对",
        intent_humor: "幽默",
        intent_question: "提问",
        hud_title: "AGENT 运行日志"
    },
    ja: {
        agent_active: "エージェント実行中：分析中...",
        scanning: "フィードをスキャン中...",
        safe_typing: "安全入力中...",
        replied: "返信済み",
        skipped: "スキップ",
        review_pending: "レビュー待ち",
        for_you: "おすすめ",
        following: "フォロー中",
        reply_to: "返信先",
        toolbar_profile: "プロフィール",
        placeholder_reply: "返信を投稿",
        placeholder_comment: "コメントを書く...",
        placeholder_email: "返信を入力...",
        btn_reply: "返信",
        btn_post: "投稿",
        btn_send: "送信",
        lbl_to: "宛先",
        lbl_subject: "件名",
        mock_fb_mind: "その気持ち、シェアしよう",
        mock_email_title: "プロジェクト協力依頼",
        mock_email_body: "件名: 協力依頼\n差出人: John Doe\n\nお世話になっております。提携の機会についてお話ししたく...",
        mock_reddit_karma: "カルマ",
        mock_reddit_joined: "参加日",
        mock_reddit_posted_by: "投稿者",
        mock_web_sim: "Webページシミュレーション",
        action_explain: "解説",
        action_translate: "翻訳",
        action_save: "メモリに保存",
        intent_agree: "同意",
        intent_disagree: "反対",
        intent_humor: "ユーモア",
        intent_question: "質問",
        hud_title: "AGENT アクティビティ"
    }
};

const GET_MOCK_PAGES = (lang: string): Record<string, PageData> => {
    const isZh = lang === 'zh';
    const isJa = lang === 'ja';
    
    return {
        'https://twitter.com/home': {
            type: 'social',
            url: 'https://twitter.com/home',
            title: 'X / Home',
            content: 'Social Feed'
        },
        'https://weibo.com/hot': {
            type: 'social',
            url: 'https://weibo.com/hot',
            title: isZh ? '微博热搜' : 'Weibo Hot Search',
            content: 'Weibo Feed'
        },
        'https://facebook.com/feed': {
            type: 'social',
            url: 'https://facebook.com/feed',
            title: 'Facebook Feed',
            content: 'Facebook Feed'
        },
        'https://reddit.com/r/technology': {
            type: 'social',
            url: 'https://reddit.com/r/technology',
            title: 'Reddit: Technology',
            content: 'Reddit Tech Feed'
        },
        'https://reddit.com/user/me': {
            type: 'profile',
            url: 'https://reddit.com/user/me',
            title: 'u/AutoAgent - Profile',
            content: isZh 
              ? `用户: u/AutoAgent\n简介: 我热爱自动化和AI。只是一个试图通过图灵测试的机器人。\n\n发帖历史:\n1. "为什么Python依然是AI首选" (技术观点)\n2. "发现了一个超酷的抓取库" (热情分享)\n3. "真心提问: 用AI写作业道德吗?" (哲学探讨)`
              : isJa
              ? `ユーザー: u/AutoAgent\n自己紹介: 自動化とAIが大好きです。チューリングテストに合格しようとしているボットです。\n\n投稿履歴:\n1. "なぜPythonはAIの王様なのか" (技術的見解)\n2. "スクレイピング用のすごいライブラリ見つけた" (熱心)\n3. "真剣な質問: 宿題にAIを使うのは倫理的?" (哲学的)`
              : `User: u/AutoAgent\nAbout: I love automation and AI. Just a bot trying to pass the Turing test.\n\nPost History:\n1. "Why Python is still king for AI pipelines." (Technical, Opinionated)\n2. "Just discovered a cool new library for scraping." (Enthusiastic, Helpful)\n3. "Honest question: Is it ethical to use AI for homework?" (Philosophical, Inquisitive)`
        },
        'https://mail.google.com/mail/u/0/#inbox/FMfcgzGqX': {
            type: 'email',
            url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzGqX',
            title: isZh ? '项目合作请求' : isJa ? 'プロジェクト協力依頼' : 'Project Collaboration Request',
            content: isZh 
                ? `主题: 项目合作请求\n发件人: John Doe\n正文: 希望您一切安好...`
                : isJa
                ? `件名: プロジェクト協力依頼\n差出人: John Doe\n本文: お元気でお過ごしでしょうか...`
                : `Subject: Project Collaboration Request\nFrom: John Doe\nBody: I hope you are doing well...`
        },
        'https://techcrunch.com/ai-agents': {
            type: 'article',
            url: 'https://techcrunch.com/ai-agents',
            title: isZh ? 'AI Agent 的未来' : 'The Future of AI Agents',
            content: `AI agents are rapidly transforming how we interact with the web...` // Content usually stays in original language unless translated
        },
        'https://youtube.com/watch?v=llm101': {
            type: 'video',
            url: 'https://youtube.com/watch?v=llm101',
            title: 'Understanding LLMs in 5 Minutes',
            content: `[00:00] Welcome...`
        },
        'https://bilibili.com/video/BV1xx411c7mD': {
            type: 'video',
            url: 'https://bilibili.com/video/BV1xx411c7mD',
            title: '【干货】10分钟学会 DeepSeek 本地部署',
            content: `[00:05] 大家好...`
        },
        'https://douyin.com/video/7321': {
            type: 'video',
            url: 'https://douyin.com/video/7321',
            title: '程序员的日常 #coding #生活',
            content: `Tag: Humor, Tech`
        },
        'https://amazon.com/dp/B09XS': {
            type: 'product',
            url: 'https://amazon.com/dp/B09XS',
            title: 'Sony WH-1000XM5 Wireless Headphones',
            content: `Price: $348.00`
        }
    };
};

// Extended with X/Y coordinates for Virtual Cursor Simulation
const SEMANTIC_MAP: Record<string, (SemanticElement & { x?: number, y?: number })[]> = {
    'twitter': [
        { id: 101, role: 'textarea', label: 'Tweet Reply', placeholder: 'Write a reply...', x: 300, y: 400 },
        { id: 102, role: 'button', label: 'Reply', x: 450, y: 500 }
    ],
    'weibo': [
        { id: 401, role: 'textarea', label: 'Weibo Reply', placeholder: '发布评论...', x: 300, y: 600 },
        { id: 402, role: 'button', label: '评论', x: 550, y: 650 }
    ],
    'facebook': [
        { id: 501, role: 'textarea', label: 'Comment', placeholder: 'Write a comment...', x: 300, y: 500 },
        { id: 502, role: 'button', label: 'Post', x: 500, y: 550 }
    ],
    'gmail': [
        { id: 201, role: 'input', label: 'To', value: 'john@example.com', x: 300, y: 200 },
        { id: 202, role: 'textarea', label: 'Email Body', placeholder: 'Type your reply...', x: 300, y: 400 },
        { id: 203, role: 'button', label: 'Send Reply', x: 600, y: 600 }
    ],
    'reddit': [
        { id: 301, role: 'textarea', label: 'Comment', placeholder: 'Write a reply...', x: 400, y: 500 },
        { id: 302, role: 'button', label: 'Reply', x: 700, y: 550 }
    ]
};

const BrowserSimulation: React.FC<BrowserSimulationProps> = ({ 
    posts, 
    activeContextId, 
    onContextChange, 
    onUpdatePost, 
    onSaveToMemory,
    pendingActions,
    onActionComplete,
    onLearnStyle,
    settings,
    agentThinking
}) => {
  const [url, setUrl] = useState('https://twitter.com/home');
  const [inputText, setInputText] = useState('');
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [isTypingSimulation, setIsTypingSimulation] = useState(false);

  // Modal State for X
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [replyingToPost, setReplyingToPost] = useState<SocialPost | null>(null);

  // Email Interaction State
  const [emailRecipient, setEmailRecipient] = useState('john@example.com');
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  // Selection & Hover State
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<{top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');

  // Virtual Cursor State
  const [cursorPos, setCursorPos] = useState({ x: -50, y: -50 }); // Start off-screen
  const [isClicking, setIsClicking] = useState(false);

  // Auto-Scroll visual
  const contentRef = useRef<HTMLDivElement>(null);
  
  const currentLang = settings?.language || 'en';
  const t = (key: string) => TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['en'][key];
  const mockPages = GET_MOCK_PAGES(currentLang);

  const INTENT_OPTIONS = [
    { id: 'Agree', label: t('intent_agree') },
    { id: 'Disagree', label: t('intent_disagree') },
    { id: 'Humorous', label: t('intent_humor') },
    { id: 'Question', label: t('intent_question') }
  ];

  // --- REAL EXTRACTION LOGIC ---
  const triggerExtraction = () => {
    if (contentRef.current) {
        // Use the REAL scanner on the rendered DOM
        const capturedContext = scanPage(contentRef.current);
        
        // Enhance captured context with metadata from our mock state for better UX
        // (In a real extension, this would come from window.location and document.title)
        capturedContext.metadata.url = url;
        capturedContext.metadata.title = mockPages[url]?.title || document.title;
        
        onContextChange(prev => ({
            ...prev,
            capturedContext
        }));
    }
  };

  // Observe DOM changes to trigger re-extraction
  useEffect(() => {
    if (!contentRef.current) return;

    // Initial Scan
    triggerExtraction();

    // Set up Observer for dynamic changes (like simulated typing or navigating)
    const observer = new MutationObserver(() => {
        triggerExtraction();
    });

    observer.observe(contentRef.current, { 
        childList: true, 
        subtree: true, 
        characterData: true,
        attributes: true 
    });

    return () => observer.disconnect();
  }, [url, posts, isReplyModalOpen, inputText]); // Re-bind if major view props change

  // Update Context when URL, Posts or Selection changes
  useEffect(() => {
      const page = mockPages[url] || mockPages['https://twitter.com/home'];
      
      let postData: SocialPost | undefined = undefined;
      let elements: SemanticElement[] = [];

      // Dynamically find the relevant post from PROPS instead of static mock
      if (url.includes('twitter')) {
          postData = activeContextId ? posts.find(p => p.id === activeContextId) : posts.find(p => p.platform === Platform.X);
          elements = SEMANTIC_MAP['twitter'];
      }
      if (url.includes('weibo')) {
          postData = posts.find(p => p.platform === Platform.Weibo);
          elements = SEMANTIC_MAP['weibo'];
      }
      if (url.includes('facebook')) {
          postData = posts.find(p => p.platform === Platform.Facebook);
          elements = SEMANTIC_MAP['facebook'];
      }
      if (url.includes('reddit') && !url.includes('user/me')) {
          postData = posts.find(p => p.platform === Platform.Reddit);
          elements = SEMANTIC_MAP['reddit'];
      }
      if (url.includes('mail')) {
          elements = SEMANTIC_MAP['gmail'];
      }

      onContextChange(prev => ({
          ...prev,
          status: postData ? 'replying' : 'reading',
          pageData: page,
          postData: postData,
          draftContent: inputText,
          visibleElements: elements,
      }));
      
  }, [url, posts, activeContextId, inputText, settings?.language]);

  // LISTEN FOR EXTERNAL DRAFT UPDATES / AUTO-PILOT
  useEffect(() => {
      if (activeContextId && url.includes('twitter')) {
          const post = posts.find(p => p.id === activeContextId);
          if (post && !isReplyModalOpen) {
              setReplyingToPost(post);
              setIsReplyModalOpen(true);
          }
      } else if (!activeContextId && isReplyModalOpen && url.includes('twitter')) {
          setIsReplyModalOpen(false);
          setReplyingToPost(null);
      }

      const activePost = activeContextId 
        ? posts.find(p => p.id === activeContextId) 
        : (replyingToPost || posts.find(p => p.platform === (url.includes('weibo') ? Platform.Weibo : Platform.X)));

      if (activePost && activePost.replyDraft && activePost.replyDraft !== inputText) {
          simulateTyping(activePost.replyDraft).then(() => {
              // --- CRITICAL AUTO-PILOT FIX ---
              // If this is an auto-reply, we must simulate the "Send" click after typing is done.
              if (activePost.isAutoReplied) {
                  setTimeout(() => {
                      // Trigger the visual "send" action (clear input, close modal)
                      // We don't need to updatePost again (App.tsx already did), 
                      // just clean up the simulation state.
                      setInputText('');
                      setIsReplyModalOpen(false);
                  }, 800); // Small delay to let user see the typed text
              }
          });
      }
  }, [posts, url, activeContextId, replyingToPost]);

  // --- SELECTION LISTENER ---
  const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0 && containerRef.current) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          setSelectedText(selection.toString());
          setSelectionRect({
              top: rect.top - containerRect.top - 40,
              left: rect.left + (rect.width / 2) - containerRect.left
          });
          onContextChange(prev => ({ ...prev, selection: selection.toString() }));
      } else {
          setSelectionRect(null);
          setSelectedText('');
          onContextChange(prev => ({ ...prev, selection: undefined }));
      }
  };

  // --- HUMAN-LIKE SIMULATION ENGINE ---
  const simulateMouseMove = async (targetX: number, targetY: number, duration: number = 800) => {
      return new Promise<void>(resolve => {
          const startX = cursorPos.x;
          const startY = cursorPos.y;
          const startTime = Date.now();

          const animate = () => {
              const now = Date.now();
              const progress = Math.min((now - startTime) / duration, 1);
              const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
              
              setCursorPos({
                  x: startX + (targetX - startX) * ease,
                  y: startY + (targetY - startY) * ease
              });

              if (progress < 1) {
                  requestAnimationFrame(animate);
              } else {
                  resolve();
              }
          };
          animate();
      });
  };

  const typingRef = useRef(false);
  
  const simulateTyping = async (fullText: string) => {
      if (typingRef.current) return;
      typingRef.current = true;
      setIsTypingSimulation(true);
      
      let currentText = ""; 
      
      // Determine typing speed based on settings
      let baseSpeed = 40; // normal
      let variance = 60;
      
      if (settings?.autoPilotSpeed === 'fast') {
          baseSpeed = 10;
          variance = 20;
      } else if (settings?.autoPilotSpeed === 'slow') {
          baseSpeed = 80;
          variance = 100;
      }

      for (let i = 0; i < fullText.length; i++) {
          currentText += fullText[i];
          setInputText(currentText);
          // Variable typing speed logic
          await new Promise(r => setTimeout(r, baseSpeed + Math.random() * variance)); 
      }
      typingRef.current = false;
      setIsTypingSimulation(false);
  };

  // --- AGENT EXECUTION LOOP ---
  useEffect(() => {
      if (pendingActions && pendingActions.length > 0) {
          executeActionSequence(pendingActions);
      }
  }, [pendingActions]);

  const executeActionSequence = async (actions: AgentAction[]) => {
      for (const action of actions) {
          let targetX = 300;
          let targetY = 300;
          
          const mapKey = url.includes('twitter') ? 'twitter' : url.includes('mail') ? 'gmail' : url.includes('weibo') ? 'weibo' : 'reddit';
          const element = SEMANTIC_MAP[mapKey]?.find(e => e.id === action.targetId);
          if (element && element.x && element.y) {
              targetX = element.x;
              targetY = element.y;
          }

          await simulateMouseMove(targetX, targetY);
          
          if (action.type === 'fill') {
              setIsClicking(true);
              setTimeout(() => setIsClicking(false), 200);
              await new Promise(r => setTimeout(r, 300));
              
              if (action.targetId === 201) setEmailRecipient(action.value || '');
              else await simulateTyping(action.value || '');
          }
          
          if (action.type === 'click') {
              setIsClicking(true);
              setTimeout(() => setIsClicking(false), 200);
              await new Promise(r => setTimeout(r, 500));

              if ([102, 302, 402, 502].includes(action.targetId || 0)) {
                  setInputText('Posting...');
                  setTimeout(() => setInputText(''), 1000);
                  setIsReplyModalOpen(false);
              }
              if (action.targetId === 203) { 
                  setIsSending(true);
                  setTimeout(() => { setIsSending(false); setHasSent(true); setInputText(''); }, 1500);
              }
          }
      }
      await simulateMouseMove(900, 800);
      if (onActionComplete) onActionComplete();
  };

  const handleAiAction = (actionId: string) => {
      setShowAiMenu(false);
      // Pass both action ID and timestamp to ensure Sidebar reacts even if same button clicked twice
      onContextChange(prev => ({ ...prev, immediateIntent: { action: actionId, timestamp: Date.now() } }));
  };

  const openXReplyModal = (post: SocialPost) => {
      setReplyingToPost(post);
      setIsReplyModalOpen(true);
      onContextChange(prev => ({ ...prev, status: 'replying', postData: post }));
  };

  const handleGenericPost = (post: SocialPost) => {
      if (onUpdatePost) onUpdatePost({...post, isAutoReplied: true, replyDraft: inputText});
      if (onLearnStyle && post.replyDraft && post.replyDraft !== inputText) onLearnStyle(post.id, inputText);
      setInputText('');
  };

  // --- RENDER HELPERS ---
  
  const renderToolbar = () => (
      <div className="h-12 bg-slate-100/80 backdrop-blur border-b border-slate-200 flex items-center px-4 space-x-2 shrink-0 overflow-x-auto no-scrollbar z-20 sticky top-0">
         <div className="flex space-x-1.5 mr-2 shrink-0 group">
             <div className="w-2.5 h-2.5 rounded-full bg-red-400 group-hover:bg-red-500 transition-colors"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 group-hover:bg-yellow-500 transition-colors"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-green-400 group-hover:bg-green-500 transition-colors"></div>
         </div>
         
         {[
             { name: 'X', url: 'https://twitter.com/home', icon: '𝕏' },
             { name: 'Weibo', url: 'https://weibo.com/hot', icon: 'WB' },
             { name: 'Reddit', url: 'https://reddit.com/r/technology', icon: 'RD' },
             { name: 'Profile', url: 'https://reddit.com/user/me', icon: <UsersIcon className="w-3 h-3"/> },
             { name: 'Bilibili', url: 'https://bilibili.com/video/BV1xx411c7mD', icon: 'B' },
             { name: 'Douyin', url: 'https://douyin.com/video/7321', icon: 'DY' },
             { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox/FMfcgzGqX', icon: <MailIcon className="w-3 h-3"/> },
             { name: 'YouTube', url: 'https://youtube.com/watch?v=llm101', icon: <VideoIcon className="w-3 h-3"/> },
             { name: 'Amazon', url: 'https://amazon.com/dp/B09XS', icon: <GlobeIcon className="w-3 h-3"/> },
         ].map(item => (
             <button 
                key={item.name}
                onClick={() => setUrl(item.url)} 
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center whitespace-nowrap transition-all cursor-pointer
                    ${url.includes(item.url.split('?')[0]) 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                        : 'text-slate-500 hover:bg-slate-200/50'}`}
             >
                <span className="mr-2 opacity-70">{item.icon}</span> {item.name === 'Profile' ? t('toolbar_profile') : item.name}
             </button>
         ))}
      </div>
  );

  const renderPageContent = () => {
      // Mock Page Data is now localized via mockPages variable
      const pageData = mockPages[url] || mockPages['https://twitter.com/home'];

      if (url.includes('twitter')) {
          return (
              <div className="max-w-[500px] mx-auto bg-black text-white min-h-full border-x border-slate-800 pb-20">
                  <div className="p-3 border-b border-slate-800 sticky top-0 bg-black/80 backdrop-blur z-10 font-bold flex justify-between">
                      <span>{t('for_you')}</span>
                      <span className="text-slate-500">{t('following')}</span>
                  </div>
                  {posts.filter(p => p.platform === Platform.X).map(post => (
                      <div 
                        key={post.id} 
                        onClick={() => openXReplyModal(post)}
                        className={`border-b border-slate-800 transition-colors duration-200 hover:bg-white/5 cursor-pointer relative group
                            ${activeContextId === post.id ? 'bg-slate-900/50 ring-1 ring-indigo-500/30' : ''}`}
                      >
                          {/* Highlight Active Processing Post */}
                          {activeContextId === post.id && agentThinking && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 animate-pulse"></div>
                          )}
                          <div className="p-4">
                               <div className="flex items-center space-x-3 mb-3">
                                   <img src={post.avatarUrl} className="w-10 h-10 rounded-full bg-slate-300" />
                                   <div>
                                       <div className="font-bold text-sm flex items-center gap-2">
                                           {post.author}
                                           {post.isSkipped && <span className="text-[10px] bg-red-900 text-red-200 px-1 rounded border border-red-800">{t('skipped')}</span>}
                                           {post.isAutoReplied && <span className="text-[10px] bg-green-900 text-green-200 px-1 rounded border border-green-800">{t('replied')}</span>}
                                           {post.reviewStatus === 'pending' && <span className="text-[10px] bg-yellow-900 text-yellow-200 px-1 rounded border border-yellow-800 animate-pulse">{t('review_pending')}</span>}
                                       </div>
                                       <div className="text-sm text-slate-500">{post.timestamp}</div>
                                   </div>
                               </div>
                               <p className="text-[15px] leading-normal mb-3 whitespace-pre-wrap">{post.content}</p>
                               <div className="flex justify-between text-sm text-slate-500 mt-3 max-w-md">
                                   <span>💬 {post.comments}</span>
                                   <span>⚡ {post.shares}</span>
                                   <span className={`flex items-center gap-1 ${post.isLiked ? 'text-pink-600 font-bold' : ''}`}>
                                       {post.isLiked ? '❤️' : '❤️'} {post.likes + (post.isLiked ? 1 : 0)}
                                   </span>
                                   <span>📊</span>
                               </div>
                          </div>
                      </div>
                  ))}
              </div>
          );
      }

      if (url.includes('weibo')) {
          return (
              <div className="max-w-[600px] mx-auto bg-[#f2f2f2] min-h-full pt-4">
                  {posts.filter(p => p.platform === Platform.Weibo).map(post => (
                      <div key={post.id} className="bg-white p-4 mb-4 shadow-sm rounded relative">
                          {activeContextId === post.id && agentThinking && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 animate-pulse rounded-l"></div>
                          )}
                          <SocialPostCard 
                            post={post} theme="light" replyText={inputText} setReplyText={setInputText} 
                            onAiAction={handleAiAction} isAutoActive={!!activeContextId} onPost={() => handleGenericPost(post)}
                            isTypingSimulation={isTypingSimulation}
                            intentOptions={INTENT_OPTIONS}
                            t={t}
                          />
                      </div>
                  ))}
              </div>
          );
      }

      if (url.includes('facebook')) {
          return (
              <div className="max-w-[600px] mx-auto bg-[#f0f2f5] min-h-full pt-4 px-4">
                  <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                      <div className="flex items-center space-x-2 mb-4">
                          <div className="w-10 h-10 rounded-full bg-blue-600"></div>
                          <div className="flex-1 bg-slate-100 h-10 rounded-full flex items-center px-4 text-slate-500 text-sm">{t('mock_fb_mind')}</div>
                      </div>
                  </div>
                  {posts.filter(p => p.platform === Platform.Facebook).map(post => (
                      <div key={post.id} className="bg-white rounded-lg shadow-sm p-4 mb-4 relative">
                          {activeContextId === post.id && agentThinking && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 animate-pulse rounded-l"></div>
                          )}
                          <SocialPostCard 
                            post={post} theme="light" replyText={inputText} setReplyText={setInputText} 
                            onAiAction={handleAiAction} isAutoActive={!!activeContextId} onPost={() => handleGenericPost(post)}
                            isTypingSimulation={isTypingSimulation}
                            intentOptions={INTENT_OPTIONS}
                            t={t}
                          />
                      </div>
                  ))}
              </div>
          );
      }

      if (url.includes('reddit')) {
          return (
              <div className="bg-[#dae0e6] min-h-full">
                  <div className="bg-white h-12 border-b border-slate-200 flex items-center px-4 sticky top-0 z-10">
                      <div className="w-8 h-8 rounded-full bg-[#ff4500] mr-2"></div>
                      <span className="font-bold">reddit</span>
                  </div>
                  <div className="max-w-[800px] mx-auto py-5 px-4 grid grid-cols-12 gap-6">
                      <div className="col-span-8 space-y-4">
                          {url.includes('user/me') ? (
                              <div className="bg-white rounded-md border border-slate-300 p-4">
                                  <h1 className="text-xl font-bold">u/AutoAgent</h1>
                                  <p className="text-sm text-slate-600 mt-2">{t('mock_reddit_karma')}: 12.5k • {t('mock_reddit_joined')} 2023</p>
                                  <div className="mt-4 space-y-4">
                                      <div className="border border-slate-200 p-3 rounded hover:border-slate-400 bg-white">
                                          <div className="text-xs text-slate-400 mb-1">{t('mock_reddit_posted_by')} u/AutoAgent</div>
                                          <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{pageData.content.split('Post History:')[1] || pageData.content}</div>
                                      </div>
                                  </div>
                              </div>
                          ) : (
                              posts.filter(p => p.platform === Platform.Reddit).map(post => (
                                  <div key={post.id} className="bg-white rounded-md border border-slate-300 relative">
                                      {activeContextId === post.id && agentThinking && (
                                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 animate-pulse rounded-l"></div>
                                      )}
                                      <div className="flex">
                                          <div className="w-10 bg-slate-50 border-r border-slate-100 flex flex-col items-center pt-2 space-y-1">
                                              <span className="text-orange-600 font-bold">⬆</span>
                                              <span className="text-sm font-bold text-slate-700">{post.likes}</span>
                                              <span className="text-slate-400 font-bold">⬇</span>
                                          </div>
                                          <div className="flex-1 p-2">
                                              <SocialPostCard 
                                                post={post} theme="light" replyText={inputText} setReplyText={setInputText} 
                                                onAiAction={handleAiAction} isAutoActive={!!activeContextId} onPost={() => handleGenericPost(post)}
                                                isTypingSimulation={isTypingSimulation}
                                                intentOptions={INTENT_OPTIONS}
                                                t={t}
                                              />
                                          </div>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                      <div className="col-span-4">
                          <div className="bg-white rounded-md border border-slate-300 p-3 text-sm">
                              <div className="font-bold text-slate-500 text-xs mb-2">COMMUNITY</div>
                              <div>r/technology</div>
                          </div>
                      </div>
                  </div>
              </div>
          );
      }

      if (url.includes('mail')) {
          return (
              <div className="max-w-4xl mx-auto bg-white min-h-[600px] shadow-sm rounded-lg border border-slate-200 mt-8 mx-8 flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
                      <h1 className="text-lg text-slate-800">{pageData.title}</h1>
                  </div>
                  <div className="p-8">
                       <div className="border border-slate-200 rounded-lg p-4 shadow-sm bg-white space-y-3 relative group">
                            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                                <span className="text-xs text-slate-500 w-10">{t('lbl_to')}:</span>
                                <span className="text-sm text-slate-700">john@example.com</span>
                            </div>
                            <div className="relative">
                                <textarea 
                                    className="w-full h-32 text-sm outline-none resize-none text-slate-700"
                                    placeholder={t('placeholder_email')}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                {isTypingSimulation && (
                                    <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center shadow-lg animate-pulse z-20">
                                        <ShieldIcon className="w-3 h-3 mr-1" />
                                        {t('safe_typing')}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end pt-2 border-t border-slate-100">
                                <button className="bg-blue-600 text-white px-4 py-2 rounded font-semibold text-sm">{t('btn_send')}</button>
                            </div>
                       </div>
                       <div className="mt-8 text-slate-500 text-sm whitespace-pre-wrap">
                           {pageData.content}
                       </div>
                  </div>
              </div>
          );
      }

      // Fallback for other pages
      return (
          <div className="bg-slate-50 min-h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                  <GlobeIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <h1 className="text-xl font-bold text-slate-600">{t('mock_web_sim')}</h1>
                  <p className="text-sm mt-2">{url}</p>
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-white relative font-sans overflow-hidden cursor-none" onMouseUp={handleMouseUp} ref={containerRef}>
      
      {/* --- VIRTUAL MOUSE CURSOR --- */}
      <div 
        className="absolute pointer-events-none z-[100] transition-transform duration-75 ease-out drop-shadow-lg"
        style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}
      >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-black fill-black stroke-white stroke-2">
              <path d="M5.5 3.21V20.8C5.5 21.61 6.52 21.97 7.03 21.34L10.76 16.68L15.82 20.57C16.2 20.87 16.76 20.77 17.02 20.35L18.6 17.81C18.85 17.4 18.74 16.86 18.36 16.57L13.46 12.8L19.46 11.59C20.23 11.44 20.39 10.39 19.71 9.99L5.5 3.21Z" />
          </svg>
          {isClicking && <div className="absolute top-0 left-0 w-8 h-8 bg-indigo-500 rounded-full opacity-50 animate-ping -translate-x-2 -translate-y-2"></div>}
      </div>

      {/* --- AGENT HUD (NEW FEATURE) --- */}
      {agentThinking && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-[400px] px-4">
              <div className="bg-black/80 backdrop-blur-md text-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-white/10 animate-in slide-in-from-top-4 duration-300">
                  <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-full animate-pulse"></div>
                  <div className="p-3 flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/50 flex items-center justify-center shrink-0 border border-indigo-500/30">
                          <TerminalIcon className="w-4 h-4 text-indigo-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{t('hud_title')}</div>
                          <div className="text-sm font-mono text-indigo-100 truncate animate-pulse">
                             &gt; {agentThinking}
                          </div>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                  </div>
              </div>
          </div>
      )}

      {/* --- X REPLY MODAL --- */}
      {isReplyModalOpen && replyingToPost && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 flex items-start justify-center pt-16 animate-in fade-in duration-200">
              <div className="bg-black w-[550px] rounded-2xl shadow-2xl text-white overflow-hidden ring-1 ring-slate-700">
                  <div className="flex justify-between items-center p-3 px-4">
                      <button onClick={() => setIsReplyModalOpen(false)} className="text-white text-lg hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
                      <span className="text-indigo-400 text-xs font-bold">Drafts</span>
                  </div>
                  <div className="px-4 pb-4 flex space-x-3">
                      <div className="flex flex-col items-center">
                          <img src={replyingToPost.avatarUrl} className="w-10 h-10 rounded-full bg-slate-700" />
                          <div className="w-0.5 flex-1 bg-slate-800 my-1"></div>
                      </div>
                      <div className="flex-1">
                          <div className="flex items-center space-x-1 mb-1">
                              <span className="font-bold text-sm">{replyingToPost.author}</span>
                              <span className="text-slate-500 text-sm">· 2h</span>
                          </div>
                          <p className="text-sm mb-3 text-slate-300">{replyingToPost.content}</p>
                          <div className="text-slate-500 text-sm mb-2">{t('reply_to')} <span className="text-indigo-400">@{replyingToPost.author.toLowerCase()}</span></div>
                      </div>
                  </div>
                  <div className="px-4 pb-4 flex space-x-3">
                      <div className="w-10 h-10 rounded-full bg-slate-600"></div>
                      <div className="flex-1 relative">
                          <textarea 
                              className="w-full bg-transparent text-lg placeholder-slate-500 outline-none resize-none min-h-[120px]"
                              placeholder={t('placeholder_reply')}
                              value={inputText}
                              onChange={(e) => setInputText(e.target.value)}
                              autoFocus
                          />
                          {/* ANTI-CHEAT VISUAL INDICATOR */}
                          {isTypingSimulation && (
                              <div className="absolute top-0 right-0 bg-green-900/90 text-green-100 border border-green-700 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center shadow-lg animate-pulse z-10">
                                  <ShieldIcon className="w-3 h-3 mr-1.5" />
                                  {t('safe_typing')}
                              </div>
                          )}

                          <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-3">
                              <div className="flex space-x-3 text-indigo-400">
                                  <ImageIcon className="w-4 h-4 cursor-pointer hover:text-indigo-300" />
                                  <div className="relative group">
                                      {!activeContextId && (
                                          <div className="cursor-pointer" onClick={() => setShowAiMenu(!showAiMenu)}>
                                            <SparklesIcon className="w-4 h-4 animate-pulse hover:text-indigo-300" />
                                          </div>
                                      )}
                                      {showAiMenu && (
                                         <div className="absolute bottom-full left-0 mb-2 w-32 bg-black border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                                             {INTENT_OPTIONS.map(opt => (
                                                 <button 
                                                    key={opt.id}
                                                    onClick={() => handleAiAction(opt.id)}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 text-slate-200"
                                                 >
                                                     {opt.label}
                                                 </button>
                                             ))}
                                         </div>
                                      )}
                                  </div>
                              </div>
                              <button 
                                onClick={() => {
                                    if (onUpdatePost) onUpdatePost({...replyingToPost, isAutoReplied: true, replyDraft: inputText});
                                    if (onLearnStyle) onLearnStyle(replyingToPost.id, inputText);
                                    setIsReplyModalOpen(false);
                                    setInputText('');
                                }}
                                disabled={!inputText}
                                className="bg-white text-black font-bold px-4 py-1.5 rounded-full text-sm disabled:opacity-50 hover:bg-slate-200 transition-colors"
                              >
                                  {t('btn_reply')}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- SELECTION POPOVER --- */}
      {selectionRect && (
          <div 
            className="absolute z-50 bg-slate-900 text-white rounded-lg shadow-xl flex items-center p-1 space-x-1 animate-in fade-in zoom-in-95"
            style={{ top: selectionRect.top, left: selectionRect.left, transform: 'translateX(-50%)' }}
          >
              <button 
                className="p-1.5 hover:bg-slate-700 rounded transition-colors" 
                title={t('action_save')}
                onClick={() => { onSaveToMemory?.(selectedText); setSelectionRect(null); }}
              >
                  <BookmarkIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button className="px-2 py-1 text-xs hover:bg-slate-700 rounded transition-colors font-medium">{t('action_explain')}</button>
              <button className="px-2 py-1 text-xs hover:bg-slate-700 rounded transition-colors font-medium">{t('action_translate')}</button>
          </div>
      )}

      {renderToolbar()}
      
      <div className="flex-1 overflow-y-auto bg-slate-50 relative scroll-smooth cursor-text" ref={contentRef}>
          {renderPageContent()}
      </div>
    </div>
  );
};

// Generic Post Card for non-X platforms
const SocialPostCard = ({ post, theme, replyText, setReplyText, onAiAction, isAutoActive, onPost, isTypingSimulation, intentOptions, t = (s: string) => s }: any) => {
    const isDark = theme === 'dark';
    const [showMenu, setShowMenu] = useState(false);
    
    return (
        <div className={`p-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
             <div className="flex items-center space-x-3 mb-3">
                 <img src={post.avatarUrl} className="w-10 h-10 rounded-full bg-slate-300" />
                 <div>
                     <div className="font-bold text-sm flex items-center gap-2">
                         {post.author}
                         {post.isSkipped && <span className="text-[10px] bg-red-900 text-red-200 px-1 rounded border border-red-800">{t('skipped')}</span>}
                         {post.isAutoReplied && <span className="text-[10px] bg-green-900 text-green-200 px-1 rounded border border-green-800">{t('replied')}</span>}
                         {post.reviewStatus === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded border border-yellow-200 animate-pulse">{t('review_pending')}</span>}
                     </div>
                     <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{post.timestamp}</div>
                 </div>
             </div>
             <p className="text-[15px] leading-normal mb-3 whitespace-pre-wrap">{post.content}</p>
             
             <div className={`flex justify-between text-sm ${isDark ? 'text-slate-500 border-slate-800' : 'text-slate-500 border-slate-100'} border-y py-2 mb-3`}>
                 <span>💬 {post.comments}</span>
                 <span>⚡ {post.shares}</span>
                 <span className={`flex items-center gap-1 ${post.isLiked ? 'text-red-500 font-bold' : ''}`}>
                     {post.isLiked ? '❤️' : '❤️'} {post.likes + (post.isLiked ? 1 : 0)}
                 </span>
             </div>

             {post.platform !== Platform.X && (
                 <div className="flex items-start space-x-3 mt-4 animate-in fade-in slide-in-from-top-2">
                     <div className={`w-8 h-8 rounded-full shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                     <div className="flex-1 relative">
                         <textarea 
                            className={`w-full p-2 text-sm outline-none resize-none rounded-lg h-24 transition-all duration-500
                                ${isDark ? 'bg-black text-white border border-slate-700' : 'bg-slate-50 text-slate-800 border border-slate-200'}
                                ${replyText ? 'ring-1 ring-indigo-500' : ''}
                            `}
                            placeholder={t('placeholder_comment')}
                            value={replyText}
                            onChange={(e: any) => setReplyText(e.target.value)}
                         />
                         
                         {/* ANTI-CHEAT OVERLAY */}
                         {isTypingSimulation && (
                              <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center shadow-lg animate-pulse z-10">
                                  <ShieldIcon className="w-3 h-3 mr-1" />
                                  {t('safe_typing')}
                              </div>
                          )}

                         {!replyText && !showMenu && !isAutoActive && (
                             <button 
                                onClick={() => setShowMenu(true)}
                                className="absolute bottom-3 right-3 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center space-x-1 pr-2"
                             >
                                 <SparklesIcon className="w-3 h-3" />
                                 <span className="text-[10px] font-bold">AI</span>
                             </button>
                         )}
                         {showMenu && (
                             <div className="absolute bottom-full right-0 mb-2 w-32 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                 {intentOptions && intentOptions.map((opt: any) => (
                                     <button 
                                        key={opt.id}
                                        onClick={() => { setShowMenu(false); onAiAction(opt.id); }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700"
                                     >
                                         {opt.label}
                                     </button>
                                 ))}
                             </div>
                         )}
                         {replyText && (
                             <div className="mt-2 flex justify-end animate-in fade-in">
                                 <button 
                                    onClick={() => onPost && onPost()}
                                    className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-blue-700 transition-colors"
                                 >
                                     {t('btn_reply')}
                                 </button>
                             </div>
                         )}
                     </div>
                 </div>
             )}
        </div>
    );
}

export default BrowserSimulation;
