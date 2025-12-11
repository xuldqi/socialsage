import React, { useState } from 'react';
import { Persona } from '../types';
import { polishContent } from '../services/geminiService';
import { SparklesIcon } from './Icons';

interface ContentEditorProps {
  activePersona: Persona;
}

const ContentEditor: React.FC<ContentEditorProps> = ({ activePersona }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (action: 'expand' | 'shorten' | 'polish' | 'translate') => {
    if (!input.trim()) return;
    setIsProcessing(true);
    try {
      const result = await polishContent(input, activePersona, action);
      setOutput(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-180px)]">
      
      {/* Input Section */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 font-medium text-slate-700 flex justify-between items-center">
           <span>Draft Input</span>
           <span className="text-xs text-slate-400">{input.length} chars</span>
        </div>
        <textarea 
          className="flex-1 w-full p-6 resize-none focus:outline-none text-slate-700 leading-relaxed"
          placeholder="Type your rough draft here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-3">
           <ActionButton 
             label="✨ Polish & Fix" 
             onClick={() => handleAction('polish')} 
             disabled={isProcessing || !input}
             loading={isProcessing}
           />
           <ActionButton 
             label="📝 Expand" 
             onClick={() => handleAction('expand')} 
             disabled={isProcessing || !input}
             loading={isProcessing}
           />
           <ActionButton 
             label="✂️ Shorten" 
             onClick={() => handleAction('shorten')} 
             disabled={isProcessing || !input}
             loading={isProcessing}
           />
           <ActionButton 
             label="🌐 Translate" 
             onClick={() => handleAction('translate')} 
             disabled={isProcessing || !input}
             loading={isProcessing}
           />
        </div>
      </div>

      {/* Output Section */}
      <div className="flex flex-col h-full bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-sm overflow-hidden relative">
        <div className="p-4 bg-indigo-100/50 border-b border-indigo-200/50 font-medium text-indigo-900 flex justify-between items-center">
           <span className="flex items-center"><SparklesIcon className="w-4 h-4 mr-2" /> AI Output ({activePersona.name})</span>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
            {output ? (
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-500">
                {output}
              </p>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <SparklesIcon className="w-12 h-12 mb-4 opacity-20" />
                 <p className="text-sm">Select an action to generate content</p>
              </div>
            )}
        </div>
        {output && (
          <div className="p-4 border-t border-indigo-200/50 flex justify-end">
             <button 
               onClick={() => {navigator.clipboard.writeText(output)}}
               className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
             >
               Copy to Clipboard
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ActionButton = ({ label, onClick, disabled, loading }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all
      ${disabled 
        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
        : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
      }`}
  >
    {loading ? 'Processing...' : label}
  </button>
);

export default ContentEditor;