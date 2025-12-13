
import React, { useState } from 'react';
import { ContentBlueprint, Persona, Platform } from '../types';
import { generateBlueprintContent, AIConfig } from '../services/geminiService';
import { FileTextIcon, SparklesIcon, EditIcon, SendIcon, PlusIcon, TrashIcon, ChevronDownIcon } from './Icons';

interface PostGeneratorProps {
    personas: Persona[];
    onUseDraft?: (draft: string) => void;
    apiKey?: string;
    aiConfig?: AIConfig;
    language?: string;
}

const TRANSLATIONS: Record<string, any> = {
    en: {
        title: "Content Blueprints",
        desc: "Generate multi-persona content.",
        new: "New Strategy",
        gen_variations: "Generate Variations",
        generating: "Generating...",
        use: "Use",
        copy: "Copy",
        edit_done: "Done Editing",
        lbl_name: "Name",
        lbl_topics: "Topics",
        lbl_platform: "Platform",
        lbl_goal: "Goal",
        lbl_personas: "Personas",
        lbl_source: "Source Material (Optional)",
        placeholder_source: "Paste tweet, article, or notes to rewrite...",
        output: "Generated Output",
        target: "Targeting",
        about: "about"
    },
    zh: {
        title: "内容蓝图",
        desc: "生成多角色内容策略。",
        new: "新策略",
        gen_variations: "生成变体",
        generating: "生成中...",
        use: "使用",
        copy: "复制",
        edit_done: "完成编辑",
        lbl_name: "名称",
        lbl_topics: "话题",
        lbl_platform: "平台",
        lbl_goal: "目标",
        lbl_personas: "人设",
        lbl_source: "源素材 (可选)",
        placeholder_source: "粘贴推文、文章或笔记以进行改写...",
        output: "生成结果",
        target: "目标受众",
        about: "关于"
    },
    ja: {
        title: "コンテンツ設計図",
        desc: "マルチペルソナコンテンツを生成。",
        new: "新しい戦略",
        gen_variations: "バリエーション生成",
        generating: "生成中...",
        use: "使用",
        copy: "コピー",
        edit_done: "編集完了",
        lbl_name: "名前",
        lbl_topics: "トピック",
        lbl_platform: "プラットフォーム",
        lbl_goal: "ゴール",
        lbl_personas: "ペルソナ",
        lbl_source: "ソース素材 (オプション)",
        placeholder_source: "ツイート、記事、メモを貼り付けてリライト...",
        output: "生成結果",
        target: "ターゲット",
        about: "について"
    }
};

const PostGenerator: React.FC<PostGeneratorProps> = ({ personas, onUseDraft, apiKey, aiConfig, language = 'en' }) => {
    const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS['en'][key];

    const [blueprints, setBlueprints] = useState<ContentBlueprint[]>([
        {
            id: 'bp1',
            name: 'Viral Tech Thread',
            type: 'post',
            category: 'informational',
            audience: 'Developers & Founders',
            topics: ['AI', 'SaaS', 'Burnout'],
            engagementGoal: 'visibility',
            platform: Platform.X,
            personaIds: [personas[0]?.id || 'p1']
        },
        {
            id: 'bp2',
            name: 'Lifestyle Daily Vlog',
            type: 'post',
            category: 'personal',
            audience: 'Gen Z',
            topics: ['OOTD', 'Cafe', 'Vibes'],
            engagementGoal: 'saves',
            platform: Platform.Xiaohongshu,
            personaIds: [personas[2]?.id || 'p3', personas[1]?.id || 'p2']
        }
    ]);

    const [activeBlueprintId, setActiveBlueprintId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);

    const effectiveConfig: AIConfig = aiConfig || { apiKey };

    const handleCreateBlueprint = () => {
        const newBp: ContentBlueprint = {
            id: Date.now().toString(),
            name: t('new'),
            type: 'post',
            category: 'informational',
            audience: 'General',
            topics: ['Topic 1'],
            engagementGoal: 'discussion',
            platform: Platform.X,
            personaIds: [personas[0].id]
        };
        setBlueprints([...blueprints, newBp]);
        setActiveBlueprintId(newBp.id);
        setIsEditing(true);
        setGeneratedContent({});
    };

    const handleUpdateBlueprint = (updated: ContentBlueprint) => {
        setBlueprints(blueprints.map(b => b.id === updated.id ? updated : b));
    };

    const handleDeleteBlueprint = (id: string) => {
        setBlueprints(blueprints.filter(b => b.id !== id));
        if (activeBlueprintId === id) setActiveBlueprintId(null);
    };

    const togglePersonaSelection = (bp: ContentBlueprint, personaId: string) => {
        const currentIds = bp.personaIds;
        const newIds = currentIds.includes(personaId)
            ? currentIds.filter(id => id !== personaId)
            : [...currentIds, personaId];
        if (newIds.length === 0) return;
        handleUpdateBlueprint({ ...bp, personaIds: newIds });
    };

    const handleGenerate = async (bp: ContentBlueprint) => {
        setIsGenerating(true);
        setGeneratedContent({});

        console.log('[PostGenerator] Starting generation with config:', {
            hasApiKey: !!effectiveConfig.apiKey,
            personaCount: bp.personaIds.length,
            sourceMaterial: bp.sourceMaterial?.substring(0, 50)
        });

        try {
            const promises = bp.personaIds.map(async (personaId) => {
                const persona = personas.find(p => p.id === personaId);
                if (!persona) {
                    console.error('[PostGenerator] Persona not found:', personaId);
                    return { id: personaId, text: "❌ 人设未找到" };
                }
                console.log('[PostGenerator] Generating for persona:', persona.name);
                const text = await generateBlueprintContent(bp, persona, 'gemini-2.0-flash', effectiveConfig, language);
                console.log('[PostGenerator] Generated text:', text?.substring(0, 100));
                return { id: personaId, text };
            });

            const results = await Promise.all(promises);
            const newContentMap: Record<string, string> = {};
            results.forEach(res => { newContentMap[res.id] = res.text; });
            setGeneratedContent(newContentMap);
        } catch (e) {
            console.error('[PostGenerator] Generation error:', e);
            // Show error in UI
            const errorMap: Record<string, string> = {};
            bp.personaIds.forEach(pid => { errorMap[pid] = `❌ 生成失败: ${e instanceof Error ? e.message : '未知错误'}`; });
            setGeneratedContent(errorMap);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4 pr-1 pb-2">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{t('title')}</h2>
                    <p className="text-xs text-slate-500">{t('desc')}</p>
                </div>
                <button onClick={handleCreateBlueprint} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 shadow-sm transition-all hover:scale-105 active:scale-95">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pb-10">
                {blueprints.map(bp => {
                    const isActive = bp.id === activeBlueprintId;
                    return (
                        <div key={bp.id} className={`rounded-xl border transition-all duration-300 overflow-hidden ${isActive ? 'bg-indigo-50/40 border-indigo-200 shadow-md ring-1 ring-indigo-100' : 'bg-white border-slate-200 hover:border-indigo-200'}`}>
                            {/* Header */}
                            <div
                                className="p-4 cursor-pointer flex justify-between items-start"
                                onClick={() => { setActiveBlueprintId(isActive ? null : bp.id); setIsEditing(false); }}
                            >
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white transition-colors ${isActive ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                        <FileTextIcon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className={`font-bold text-sm truncate ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{bp.name}</h3>
                                        <div className="flex items-center text-[10px] text-slate-500 font-medium uppercase tracking-wider space-x-1.5 mt-0.5">
                                            <span className="bg-white px-1.5 rounded border border-slate-100">{bp.platform}</span>
                                            <span>{bp.category}</span>
                                        </div>
                                    </div>
                                    <div className={`text-slate-400 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`}>
                                        <ChevronDownIcon className="w-4 h-4" />
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="flex space-x-1 ml-2">
                                        <button onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded">
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) handleDeleteBlueprint(bp.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Expanded Body */}
                            {isActive && (
                                <div className="px-4 pb-4 animate-in slide-in-from-top-2">

                                    {/* Config/Edit Area */}
                                    {isEditing ? (
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-3 shadow-sm">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">{t('lbl_name')}</label>
                                                <input className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-500" value={bp.name} onChange={e => handleUpdateBlueprint({ ...bp, name: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">{t('lbl_topics')}</label>
                                                <input className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-500" value={bp.topics.join(', ')} onChange={e => handleUpdateBlueprint({ ...bp, topics: e.target.value.split(',').map(s => s.trim()) })} />
                                            </div>

                                            {/* Source Material Input */}
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">{t('lbl_source')}</label>
                                                <textarea
                                                    className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-indigo-500 h-16 resize-none"
                                                    placeholder={t('placeholder_source')}
                                                    value={bp.sourceMaterial || ''}
                                                    onChange={e => handleUpdateBlueprint({ ...bp, sourceMaterial: e.target.value })}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('lbl_platform')}</label>
                                                    <select className="w-full text-xs border border-slate-200 rounded p-1.5 bg-white" value={bp.platform} onChange={e => handleUpdateBlueprint({ ...bp, platform: e.target.value as Platform })}>
                                                        {(Object.values(Platform) as string[]).map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{t('lbl_goal')}</label>
                                                    <select className="w-full text-xs border border-slate-200 rounded p-1.5 bg-white" value={bp.engagementGoal} onChange={e => handleUpdateBlueprint({ ...bp, engagementGoal: e.target.value as any })}>
                                                        {['visibility', 'discussion', 'saves', 'conversion'].map(g => <option key={g} value={g}>{g}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t('lbl_personas')}</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {personas.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => togglePersonaSelection(bp, p.id)}
                                                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${bp.personaIds.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                                                        >
                                                            {p.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button onClick={() => setIsEditing(false)} className="w-full bg-slate-100 text-slate-600 text-xs font-bold py-2 rounded hover:bg-slate-200 mt-1">{t('edit_done')}</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                {bp.personaIds.map(pid => (
                                                    <div key={pid} className="flex items-center space-x-1 bg-white border border-indigo-100 px-2 py-1 rounded-full shadow-sm">
                                                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-[8px] flex items-center justify-center font-bold">
                                                            {personas.find(p => p.id === pid)?.name[0]}
                                                        </div>
                                                        <span className="text-[10px] text-slate-700 font-medium">{personas.find(p => p.id === pid)?.name}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {bp.sourceMaterial && (
                                                <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-500 italic line-clamp-2">
                                                    "{bp.sourceMaterial}"
                                                </div>
                                            )}

                                            <div className="bg-white/50 border border-indigo-100 rounded p-2 text-xs text-slate-600 italic">
                                                {t('target')} <span className="font-bold not-italic">{bp.audience}</span> {t('about')} <span className="font-bold not-italic">{bp.topics.join(', ')}</span>.
                                            </div>
                                            <button
                                                onClick={() => handleGenerate(bp)}
                                                disabled={isGenerating}
                                                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-wait active:scale-[0.98]"
                                            >
                                                {isGenerating ? <SparklesIcon className="w-4 h-4 mr-2 animate-spin" /> : <SparklesIcon className="w-4 h-4 mr-2" />}
                                                {isGenerating ? t('generating') : t('gen_variations')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Output Section */}
                                    {Object.keys(generatedContent).length > 0 && !isGenerating && (
                                        <div className="mt-5 pt-4 border-t border-indigo-100 space-y-3 animate-in fade-in">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('output')}</h4>
                                            {Object.entries(generatedContent).map(([pid, content]) => {
                                                const p = personas.find(x => x.id === pid);
                                                return (
                                                    <div key={pid} className="bg-white p-3 rounded-lg border border-indigo-50 shadow-sm group hover:border-indigo-200 transition-colors">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                                                    {p?.name[0]}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700">{p?.name}</span>
                                                            </div>
                                                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => navigator.clipboard.writeText(content as string)} className="text-[10px] text-slate-400 hover:text-indigo-600" title={t('copy')}>
                                                                    <FileTextIcon className="w-3 h-3" />
                                                                </button>
                                                                {onUseDraft && (
                                                                    <button onClick={() => onUseDraft(content as string)} className="text-[10px] text-indigo-600 hover:underline font-bold" title={t('use')}>
                                                                        {t('use')}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{content}</p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PostGenerator;
