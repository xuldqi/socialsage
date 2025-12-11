/**
 * Tool Result Display Component
 * 
 * 展示工具调用结果：
 * - JSON 格式
 * - 表格格式
 * - 文本格式
 */

import React, { useState } from 'react';
import { ToolResult, ToolCall } from '../types/agent';
import { CopyIcon, CheckIcon, ChevronDownIcon, TableIcon, CodeIcon } from './Icons';

// ============================================
// Types
// ============================================

interface ToolResultDisplayProps {
  toolCall?: ToolCall;
  result: ToolResult;
  compact?: boolean;
}

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  isExpanded?: boolean;
}

// ============================================
// Tool Call Display
// ============================================

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ toolCall, isExpanded = false }) => {
  const [expanded, setExpanded] = useState(isExpanded);
  
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 my-2">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 text-xs font-medium">🔧 Tool Call</span>
          <span className="text-indigo-800 font-semibold text-sm">{toolCall.tool}</span>
        </div>
        <ChevronDownIcon 
          className={`w-4 h-4 text-indigo-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
        />
      </div>
      
      {expanded && (
        <div className="mt-2 pt-2 border-t border-indigo-100">
          <pre className="text-xs text-indigo-700 bg-indigo-100/50 rounded p-2 overflow-x-auto">
            {JSON.stringify(toolCall.parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// ============================================
// Tool Result Display
// ============================================

export const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({ 
  toolCall, 
  result, 
  compact = false 
}) => {
  const [viewMode, setViewMode] = useState<'text' | 'json' | 'table'>('text');
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    const text = result.displayText || JSON.stringify(result.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // 检查数据是否可以显示为表格
  const canShowTable = result.data?.entities?.length > 0 || 
                       (Array.isArray(result.data) && result.data.length > 0);
  
  if (!result.success) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-3 my-2">
        <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
          <span>⚠️</span>
          <span>Error</span>
        </div>
        <p className="text-red-700 text-sm mt-1">{result.error}</p>
        {result.suggestions && result.suggestions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-red-100">
            <p className="text-red-600 text-xs font-medium">Suggestions:</p>
            <ul className="text-red-600 text-xs mt-1 list-disc list-inside">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  
  if (compact) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-lg p-3 my-2">
        <div className="flex items-center justify-between">
          <span className="text-green-600 text-xs font-medium">✓ Success</span>
          <button 
            onClick={handleCopy}
            className="text-green-600 hover:text-green-800 p-1"
          >
            {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-green-800 text-sm mt-1 line-clamp-3">
          {result.displayText || 'Operation completed successfully.'}
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg my-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-xs font-medium">✓ Result</span>
          {toolCall && (
            <span className="text-slate-500 text-xs">from {toolCall.tool}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* View Mode Toggle */}
          {canShowTable && (
            <button
              onClick={() => setViewMode(viewMode === 'table' ? 'text' : 'table')}
              className={`p-1 rounded ${viewMode === 'table' ? 'bg-slate-200' : 'hover:bg-slate-200'}`}
              title="Toggle table view"
            >
              <TableIcon className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'json' ? 'text' : 'json')}
            className={`p-1 rounded ${viewMode === 'json' ? 'bg-slate-200' : 'hover:bg-slate-200'}`}
            title="Toggle JSON view"
          >
            <CodeIcon className="w-4 h-4 text-slate-500" />
          </button>
          <button 
            onClick={handleCopy}
            className="p-1 rounded hover:bg-slate-200"
            title="Copy to clipboard"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-600" />
            ) : (
              <CopyIcon className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        {viewMode === 'text' && (
          <p className="text-slate-700 text-sm whitespace-pre-wrap">
            {result.displayText || 'Operation completed successfully.'}
          </p>
        )}
        
        {viewMode === 'json' && (
          <pre className="text-xs text-slate-600 bg-slate-100 rounded p-2 overflow-x-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
        
        {viewMode === 'table' && canShowTable && (
          <DataTable data={result.data?.entities || result.data} />
        )}
      </div>
    </div>
  );
};

// ============================================
// Data Table Component
// ============================================

interface DataTableProps {
  data: any[];
}

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  // 获取所有列
  const columns = Object.keys(data[0]);
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100">
            {columns.map(col => (
              <th key={col} className="px-2 py-1 text-left text-slate-600 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map(col => (
                <td key={col} className="px-2 py-1 text-slate-700">
                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 20 && (
        <p className="text-xs text-slate-400 mt-2 text-center">
          Showing 20 of {data.length} items
        </p>
      )}
    </div>
  );
};

// ============================================
// Thinking Display
// ============================================

interface ThinkingDisplayProps {
  thought: string;
  isExpanded?: boolean;
}

export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({ thought, isExpanded = false }) => {
  const [expanded, setExpanded] = useState(isExpanded);
  
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 my-2">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-600 text-xs font-medium">💭 Thinking</span>
        </div>
        <ChevronDownIcon 
          className={`w-4 h-4 text-amber-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
        />
      </div>
      
      {expanded && (
        <p className="text-amber-700 text-sm mt-2 pt-2 border-t border-amber-100">
          {thought}
        </p>
      )}
    </div>
  );
};

export default ToolResultDisplay;
