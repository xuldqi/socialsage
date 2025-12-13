
import React, { useState } from 'react';
import { Persona } from '../types';
import { EditIcon, TrashIcon, SparklesIcon } from './Icons';
import { useToast } from './Toast';

interface PersonaManagerProps {
  personas: Persona[];
  defaultPersonaId?: string;
  onCreate: (p: Persona) => void;
  onUpdate?: (p: Persona) => void;
  onDelete?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  language?: string;
}

const TRANSLATIONS: Record<string, any> = {
  en: {
    title: "Persona Library",
    desc: "Manage your AI writing styles.",
    new: "+ New",
    cancel: "Cancel",
    edit: "Edit Persona",
    create: "Create New Persona",
    name: "Name",
    tone: "Tone",
    description: "Description",
    example: "Example Text",
    update: "Update",
    save: "Save",
    voice_sample: "Voice Sample",
    active: "Active",
    delete_confirm: "Delete this persona?",
    set_default: "Set as Default",
    active_persona: "Active Persona",
    delete: "Delete",
    msg_delete_active: "Cannot delete the active persona.",
    msg_min_one: "Must keep at least one persona."
  },
  zh: {
    title: "人设库",
    desc: "管理你的AI写作风格。",
    new: "+ 新建",
    cancel: "取消",
    edit: "编辑人设",
    create: "创建新人设",
    name: "名称",
    tone: "语气",
    description: "描述",
    example: "示例文本",
    update: "更新",
    save: "保存",
    voice_sample: "声音样本",
    active: "当前使用",
    delete_confirm: "删除此人设？",
    set_default: "设为默认",
    active_persona: "当前人设",
    delete: "删除",
    msg_delete_active: "无法删除当前激活的人设。",
    msg_min_one: "必须至少保留一个人设。"
  },
  ja: {
    title: "ペルソナライブラリ",
    desc: "AIの書き方を管理します。",
    new: "+ 新規",
    cancel: "キャンセル",
    edit: "ペルソナを編集",
    create: "新しいペルソナを作成",
    name: "名前",
    tone: "トーン",
    description: "説明",
    example: "例文",
    update: "更新",
    save: "保存",
    voice_sample: "ボイスサンプル",
    active: "アクティブ",
    delete_confirm: "このペルソナを削除しますか？",
    set_default: "デフォルトに設定",
    active_persona: "アクティブなペルソナ",
    delete: "削除",
    msg_delete_active: "アクティブなペルソナは削除できません。",
    msg_min_one: "少なくとも1つのペルソナが必要です。"
  }
};

const PersonaManager: React.FC<PersonaManagerProps> = ({ personas, defaultPersonaId, onCreate, onUpdate, onDelete, onSetDefault, language = 'en' }) => {
  const { showToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS['en'][key];

  const [formData, setFormData] = useState<Omit<Persona, 'id'>>({
    name: '',
    description: '',
    tone: '',
    exampleText: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId && onUpdate) {
      onUpdate({
        id: editingId,
        ...formData
      });
      setEditingId(null);
    } else {
      onCreate({
        id: Date.now().toString(),
        ...formData
      });
    }

    setFormData({ name: '', description: '', tone: '', exampleText: '' });
    setIsCreating(false);
    showToast(language === 'zh' ? '人设已保存' : 'Persona saved', 'success');
  };

  const handleEditStart = (p: Persona) => {
    setFormData({
      name: p.name,
      description: p.description,
      tone: p.tone,
      exampleText: p.exampleText
    });
    setEditingId(p.id);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: '', description: '', tone: '', exampleText: '' });
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('title')}</h2>
          <p className="text-slate-500 text-xs mt-0.5">{t('desc')}</p>
        </div>
        <button
          onClick={() => { setIsCreating(!isCreating); setEditingId(null); setFormData({ name: '', description: '', tone: '', exampleText: '' }); }}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          {isCreating ? t('cancel') : t('new')}
        </button>
      </div>

      {/* Creation/Edit Form */}
      {isCreating && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2 shrink-0">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">{editingId ? t('edit') : t('create')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('name')}</label>
              <input
                required
                type="text"
                placeholder="e.g. Tech Bro"
                className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('tone')}</label>
              <input
                required
                type="text"
                placeholder="e.g. Witty"
                className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.tone}
                onChange={e => setFormData({ ...formData, tone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('description')}</label>
            <input
              required
              type="text"
              placeholder="Short description..."
              className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('example')}</label>
            <textarea
              required
              rows={2}
              placeholder="Paste sample text..."
              className="w-full border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              value={formData.exampleText}
              onChange={e => setFormData({ ...formData, exampleText: e.target.value })}
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button type="button" onClick={handleCancel} className="px-3 py-1.5 text-slate-500 text-xs hover:text-slate-700">
              {t('cancel')}
            </button>
            <button type="submit" className="bg-indigo-600 text-white px-4 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-700">
              {editingId ? t('update') : t('save')}
            </button>
          </div>
        </form>
      )}

      {/* Vertical List of Personas (Single Column) */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
        {personas.map(p => {
          const isDefault = p.id === defaultPersonaId;
          // Safeguard Logic:
          // 1. Cannot delete the Active (Default) Persona
          // 2. Cannot delete the Last Remaining Persona
          const canDelete = !isDefault && personas.length > 1;

          return (
            <div
              key={p.id}
              className={`bg-white p-4 rounded-xl border shadow-sm transition-all group relative flex flex-col gap-2
                ${isDefault ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300'}`}
              onClick={() => { if (onSetDefault && !isDefault) { onSetDefault(p.id); showToast(language === 'zh' ? '已设为默认' : 'Set as default', 'success'); } }}
            >
              {/* Action Buttons */}
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 
                          ${isDefault ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-sm truncate ${isDefault ? 'text-indigo-700' : 'text-slate-800'}`}>{p.name}</h3>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{p.tone}</p>
                  </div>
                </div>

                <div className="flex space-x-1 pl-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); if (onSetDefault) { onSetDefault(p.id); showToast(language === 'zh' ? '已设为默认' : 'Set as default', 'success'); } }}
                    className={`p-1.5 rounded transition-colors ${isDefault ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-500'}`}
                    title={isDefault ? t('active_persona') : t('set_default')}
                  >
                    <SparklesIcon className={`w-4 h-4 ${isDefault ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditStart(p); }}
                    className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title={t('edit')}
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDelete && confirm(t('delete_confirm'))) {
                          onDelete(p.id);
                          showToast(language === 'zh' ? '已删除' : 'Deleted', 'info');
                        }
                      }}
                      disabled={!canDelete}
                      className={`p-1.5 rounded transition-colors ${canDelete ? 'text-slate-300 hover:text-red-600 hover:bg-red-50' : 'text-slate-200 cursor-not-allowed opacity-50'}`}
                      title={!canDelete ? (isDefault ? t('msg_delete_active') : t('msg_min_one')) : t('delete')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pl-11">
                {p.description}
              </p>

              {/* Example Preview */}
              <div className="bg-slate-50 p-2 rounded border border-slate-100 ml-11 mt-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{t('voice_sample')}</p>
                <p className="text-[10px] text-slate-600 font-mono italic line-clamp-2">"{p.exampleText}"</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonaManager;
