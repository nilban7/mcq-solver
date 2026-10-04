import React from 'react';
import { AiSolveResult, McqOptionKey } from '../../shared/types.js';
import { CheckCircle2, AlertTriangle, RefreshCw, Camera, Edit3 } from 'lucide-react';

interface Props {
  result: AiSolveResult;
  overrideAnswer?: McqOptionKey | null;
  onOpenOverride: () => void;
  onResolve: () => void;
  onClickPhoto: () => void;
  isResolving?: boolean;
}

export const BigAnswerCard: React.FC<Props> = ({
  result,
  overrideAnswer,
  onOpenOverride,
  onResolve,
  onClickPhoto,
  isResolving = false,
}) => {
  const displayAnswer = overrideAnswer || result.answer;
  const isVerified = !overrideAnswer && result.verificationStatus === 'VERIFIED';
  const confidencePercent = Math.round(result.confidence * 100);

  const getConfidenceBadge = (conf: number) => {
    if (conf >= 0.95) return { text: 'HIGH', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    if (conf >= 0.85) return { text: 'GOOD', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    if (conf >= 0.70) return { text: 'REVIEW', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    return { text: 'LOW / REVIEW REQUIRED', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' };
  };

  const confBadge = getConfidenceBadge(result.confidence);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
      {/* MASSIVE PROMINENT ANSWER CARD */}
      <div className={`w-full rounded-3xl p-8 md:p-12 border shadow-2xl transition-all duration-300 ${
        isVerified 
          ? 'bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-500/40 shadow-emerald-950/40' 
          : overrideAnswer
            ? 'bg-gradient-to-b from-indigo-950/60 via-slate-900 to-slate-950 border-indigo-500/40 shadow-indigo-950/40'
            : 'bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border-amber-500/40 shadow-amber-950/40'
      }`}>
        <div className="flex flex-col items-center text-center">
          <span className="text-xs md:text-sm font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Correct Answer Option
          </span>

          {/* THE GIANT ANSWER LETTER */}
          <div className="my-2 relative flex items-center justify-center">
            <span className={`text-9xl md:text-[11rem] font-black tracking-tight leading-none drop-shadow-2xl ${
              isVerified ? 'text-emerald-400' : overrideAnswer ? 'text-indigo-400' : 'text-amber-400'
            }`}>
              {displayAnswer || '?'}
            </span>
          </div>

          {/* VERIFICATION & CONFIDENCE BADGES */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-1 mb-6">
            {isVerified ? (
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-sm tracking-wide shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>✓ VERIFIED</span>
              </div>
            ) : overrideAnswer ? (
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-sm tracking-wide">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>MANUALLY OVERRIDDEN (AI: {result.answer})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-sm tracking-wide">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>⚠ REVIEW REQUIRED</span>
              </div>
            )}

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${confBadge.color}`}>
              <span>Confidence: {confidencePercent}%</span>
              <span>•</span>
              <span>{confBadge.text}</span>
            </div>

            {result.providerUsed && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-700/80 bg-slate-800/80 text-amber-300 text-xs font-semibold">
                <span>⚡ {result.providerUsed}</span>
              </div>
            )}
          </div>

          {/* QUESTION TEXT */}
          <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-left my-4 shadow-inner">
            <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-snug mb-4">
              {result.question}
            </h3>

            {/* OPTIONS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as McqOptionKey[]).map((key) => {
                const isSelected = displayAnswer === key;
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-100 font-semibold ring-2 ring-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                      isSelected ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {key}
                    </span>
                    <span className="text-sm pt-0.5 leading-relaxed">
                      {result.options[key] || <span className="italic text-slate-500">Option empty</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* EXPLANATION */}
            {result.explanation && (
              <div className="mt-5 pt-4 border-t border-slate-800/80 text-xs md:text-sm text-slate-400">
                <span className="font-semibold text-slate-300 mr-1.5">💡 Explanation:</span>
                {result.explanation}
              </div>
            )}
          </div>

          {/* PRIMARY DESKTOP CONTROL BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4 w-full">
            {/* THE BIG "CLICK PHOTO" SHUTTER BUTTON */}
            <button
              onClick={onClickPhoto}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-lg transition-all shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/20"
            >
              <Camera className="w-6 h-6" />
              <span>📸 CLICK PHOTO (NEXT MCQ)</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-950/20 text-slate-900 font-mono ml-1">
                Space
              </span>
            </button>

            <button
              onClick={onOpenOverride}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all active:scale-95"
            >
              <Edit3 className="w-4 h-4 text-slate-400" />
              <span>Change Answer</span>
            </button>

            <button
              onClick={onResolve}
              disabled={isResolving}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${isResolving ? 'animate-spin' : ''}`} />
              <span>{isResolving ? 'Re-solving...' : 'Re-solve'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
