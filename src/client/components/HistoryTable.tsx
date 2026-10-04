import React, { useState } from 'react';
import { HistoryItem, McqOptionKey } from '../../shared/types.js';
import { FileSpreadsheet, FileText, Download, Trash2, Search, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { exportToCsv, exportToXlsx, exportToPdf } from '../lib/export.js';

interface Props {
  history: HistoryItem[];
  onClearHistory: () => void;
  onOverrideItem: (item: HistoryItem) => void;
}

export const HistoryTable: React.FC<Props> = ({
  history,
  onClearHistory,
  onOverrideItem,
}) => {
  const [search, setSearch] = useState('');

  const filtered = history.filter((item) => {
    const q = (item.question || '').toLowerCase();
    const ans = (item.finalAnswer || '').toLowerCase();
    const s = search.toLowerCase();
    return q.includes(s) || ans.includes(s);
  });

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Session History & Answer Key</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
              {history.length} Questions
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Persisted in browser IndexedDB. Export to CSV, Excel, or PDF.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportToCsv(history)}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => exportToXlsx(history)}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-xs font-semibold text-emerald-300 border border-emerald-800/60 disabled:opacity-40 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>XLSX</span>
          </button>

          <button
            onClick={() => exportToPdf(history)}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-xs font-semibold text-indigo-300 border border-indigo-800/60 disabled:opacity-40 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all recorded history from this browser?')) {
                  onClearHistory();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-xs font-semibold text-rose-300 border border-rose-800/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      {history.length > 0 && (
        <div className="my-4 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search questions or answers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Table */}
      {history.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          No questions solved yet. Open camera on your phone and tap <strong className="text-slate-400">Capture & Solve</strong>!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Question Statement</th>
                <th className="py-3 px-3 text-center">AI Ans</th>
                <th className="py-3 px-3 text-center">Final Ans</th>
                <th className="py-3 px-3 text-center">Confidence</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>
                  <td className="py-3 px-3 text-slate-200 font-medium max-w-md truncate">
                    {item.question}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-400">
                    {item.aiAnswer || '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-lg font-black text-sm ${
                      item.isOverridden
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {item.finalAnswer || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-400">
                    {Math.round(item.confidence * 100)}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    {item.isOverridden ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                        <Edit3 className="w-3 h-3" /> Corrected
                      </span>
                    ) : item.verificationStatus === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Review
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onOverrideItem(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Edit / Override Answer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
