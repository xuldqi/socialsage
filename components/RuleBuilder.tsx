

import React from 'react';
import { AutoRule, Persona, Platform } from '../types';
import { ZapIcon, EditIcon, TrashIcon } from './Icons';

interface RuleBuilderProps {
  rules: AutoRule[];
  personas: Persona[];
  onUpdateRule: (r: AutoRule) => void;
  onDeleteRule: (id: string) => void;
  language?: string;
}

const TRANSLATIONS: Record<string, any> = {
    en: {
        title: "Auto-Pilot Rules",
        desc: "Configure sophisticated logic for how the AI handles different types of posts.",
        skip: "Skip Logic",
        triggers: "Triggers",
        actions: "Actions",
        min_likes: "Min Likes",
        min_comments: "Min Comments",
        keywords: "Keywords (Comma separated)",
        action_type: "Action Type",
        reply: "✍️ Reply",
        ignore: "🚫 Skip / Ignore",
        use_persona: "Use Persona",
        instruction: "Specific Instruction",
        delete_confirm: "Delete this rule?",
        all_platforms: "All Platforms",
        lbl_like_first: "❤️ Like post before replying"
    },
    zh: {
        title: "自动驾驶规则",
        desc: "配置AI如何处理不同类型帖子的逻辑。",
        skip: "跳过",
        triggers: "触发条件",
        actions: "执行动作",
        min_likes: "最少点赞数",
        min_comments: "最少评论数",
        keywords: "关键词 (逗号分隔)",
        action_type: "动作类型",
        reply: "✍️ 回复",
        ignore: "🚫 跳过 / 忽略",
        use_persona: "使用人设",
        instruction: "特定指令",
        delete_confirm: "删除此规则？",
        all_platforms: "所有平台",
        lbl_like_first: "❤️ 回复前先点赞 (暖场)"
    },
    ja: {
        title: "オートパイロットルール",
        desc: "AIが投稿を処理する方法を構成します。",
        skip: "スキップ",
        triggers: "トリガー",
        actions: "アクション",
        min_likes: "最小いいね数",
        min_comments: "最小コメント数",
        keywords: "キーワード (カンマ区切り)",
        action_type: "アクションタイプ",
        reply: "✍️ 返信",
        ignore: "🚫 スキップ",
        use_persona: "ペルソナを使用",
        instruction: "具体的な指示",
        delete_confirm: "このルールを削除しますか？",
        all_platforms: "全プラットフォーム",
        lbl_like_first: "❤️ 返信前に「いいね」する"
    }
};

const RuleBuilder: React.FC<RuleBuilderProps> = ({ rules, personas, onUpdateRule, onDeleteRule, language = 'en' }) => {
  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS['en'][key];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
         <h2 className="text-xl font-bold text-slate-800 mb-2">{t('title')}</h2>
         <p className="text-slate-500 mb-6">{t('desc')}</p>

         <div className="space-y-4">
            {rules.map(rule => (
              <div key={rule.id} className={`border rounded-xl p-5 transition-all ${rule.isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white opacity-60'}`}>
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                       <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <ZapIcon className="w-5 h-5" />
                       </div>
                       <div>
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            {rule.name}
                            {rule.actionType === 'skip' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-wide">{t('skip')}</span>}
                          </h3>
                          <div className="text-xs text-slate-500 flex items-center space-x-2 mt-1">
                             <span className="uppercase tracking-wider font-semibold">{rule.platform || t('all_platforms')}</span>
                             <span>•</span>
                             <span>Likes &gt; {rule.minLikes}</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center space-x-3">
                         <button 
                            onClick={() => { if(window.confirm(t('delete_confirm'))) onDeleteRule(rule.id) }}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete Rule"
                         >
                            <TrashIcon className="w-4 h-4" />
                         </button>
                         <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={rule.isActive}
                            onChange={() => onUpdateRule({...rule, isActive: !rule.isActive})}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 pt-4 border-t border-indigo-100/50">
                    {/* Triggers Section */}
                    <div className="lg:col-span-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('triggers')}</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('min_likes')}</label>
                            <input 
                                type="number" 
                                className="w-full text-sm p-2 border border-slate-200 rounded-md"
                                value={rule.minLikes}
                                onChange={(e) => onUpdateRule({...rule, minLikes: parseInt(e.target.value)})}
                            />
                         </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">{t('min_comments')}</label>
                            <input 
                                type="number" 
                                className="w-full text-sm p-2 border border-slate-200 rounded-md"
                                value={rule.minComments || 0}
                                onChange={(e) => onUpdateRule({...rule, minComments: parseInt(e.target.value)})}
                            />
                         </div>
                         <div className="col-span-2">
                           <label className="block text-xs font-semibold text-slate-500 mb-1">{t('keywords')}</label>
                           <input 
                              type="text" 
                              className="w-full text-sm p-2 border border-slate-200 rounded-md"
                              value={rule.keywords.join(', ')}
                              onChange={(e) => onUpdateRule({...rule, keywords: e.target.value.split(',').map(s => s.trim())})}
                              placeholder="e.g. AI, Crypto"
                           />
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:block lg:col-span-1 border-r border-slate-100 mx-auto h-full"></div>

                    {/* Actions Section */}
                    <div className="lg:col-span-6 space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('actions')}</h4>
                      <div className="grid grid-cols-1 gap-4">
                         <div>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">{t('action_type')}</label>
                           <div className="flex space-x-2">
                              <button 
                                onClick={() => onUpdateRule({...rule, actionType: 'reply'})}
                                className={`flex-1 py-2 text-sm rounded-md border font-medium transition-colors ${rule.actionType !== 'skip' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                              >
                                {t('reply')}
                              </button>
                              <button 
                                onClick={() => onUpdateRule({...rule, actionType: 'skip'})}
                                className={`flex-1 py-2 text-sm rounded-md border font-medium transition-colors ${rule.actionType === 'skip' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}
                              >
                                {t('ignore')}
                              </button>
                           </div>
                         </div>

                         {rule.actionType !== 'skip' && (
                           <>
                            {/* Like Toggle */}
                            <div className="flex items-center space-x-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <input 
                                    type="checkbox"
                                    id={`like-${rule.id}`}
                                    checked={!!rule.performLike}
                                    onChange={(e) => onUpdateRule({...rule, performLike: e.target.checked})}
                                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor={`like-${rule.id}`} className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                                    {t('lbl_like_first')}
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('use_persona')}</label>
                                <select 
                                    className="w-full text-sm p-2 border border-slate-200 rounded-md bg-white"
                                    value={rule.actionPersonaId}
                                    onChange={(e) => onUpdateRule({...rule, actionPersonaId: e.target.value})}
                                >
                                    {personas.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">{t('instruction')}</label>
                                <input 
                                    type="text" 
                                    className="w-full text-sm p-2 border border-slate-200 rounded-md"
                                    value={rule.customInstruction || ''}
                                    onChange={(e) => onUpdateRule({...rule, customInstruction: e.target.value})}
                                    placeholder="e.g. Ask a question, Be extremely supportive..."
                                />
                            </div>
                           </>
                         )}
                      </div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export default RuleBuilder;