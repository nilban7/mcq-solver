import React, { useState } from 'react';
import { McqOptionKey } from '../../shared/types.js';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentAnswer: McqOptionKey | null;
  aiAnswer: McqOptionKey | null;
  options: Record<McqOptionKey, string>;
  onSaveOverride: (selected: McqOptionKey) => void;
}

export const ManualOverrideModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentAnswer,
  aiAnswer,
  options,
  onSaveOverride,
}) => {
  const [selected, setSelected] = useState<McqOptionKey>(currentAnswer || 'A');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveOverride(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Manual Answer Override</h3>
            <p className="text-xs text-slate-400">Original AI prediction: Option {aiAnswer || 'None'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-2.5">
          {(['A', 'B', 'C', 'D'] as McqOptionKey[]).map((key) => {
            const isSelected = selected === key;
            const isAiChoice = aiAnswer === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium ring-1 ring-indigo-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {key}
                  </span>
                  <span className="text-sm line-clamp-1">
                    {options[key] || `Option ${key}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isAiChoice && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      AI Choice
                    </span>
                  )}
                  {isSelected && <Check className="w-5 h-5 text-indigo-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
          >
            Confirm Override
          </button>
        </div>
      </div>
    </div>
  );
};
