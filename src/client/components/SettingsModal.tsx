import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Cpu } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export interface AppSettings {
  provider: 'demo' | 'gemini' | 'openai' | 'groq';
  apiKey: string;
  groqKey1?: string;
  groqKey2?: string;
  geminiKey?: string;
  enableVerification: boolean;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}) => {
  const [provider, setProvider] = useState<'demo' | 'gemini' | 'openai' | 'groq'>(currentSettings.provider);
  const [apiKey, setApiKey] = useState(currentSettings.apiKey || '');
  const [groqKey1, setGroqKey1] = useState(currentSettings.groqKey1 || (currentSettings.provider === 'groq' ? currentSettings.apiKey : '') || '');
  const [groqKey2, setGroqKey2] = useState(currentSettings.groqKey2 || '');
  const [geminiKey, setGeminiKey] = useState(currentSettings.geminiKey || (currentSettings.provider === 'gemini' ? currentSettings.apiKey : '') || '');
  const [enableVerification, setEnableVerification] = useState(currentSettings.enableVerification);

  useEffect(() => {
    setProvider(currentSettings.provider);
    setApiKey(currentSettings.apiKey || '');
    setGroqKey1(currentSettings.groqKey1 || (currentSettings.provider === 'groq' ? currentSettings.apiKey : '') || '');
    setGroqKey2(currentSettings.groqKey2 || '');
    setGeminiKey(currentSettings.geminiKey || (currentSettings.provider === 'gemini' ? currentSettings.apiKey : '') || '');
    setEnableVerification(currentSettings.enableVerification);
  }, [currentSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      apiKey: provider === 'groq' ? (groqKey1 || apiKey).trim() : provider === 'gemini' ? (geminiKey || apiKey).trim() : apiKey.trim(),
      groqKey1: groqKey1.trim(),
      groqKey2: groqKey2.trim(),
      geminiKey: geminiKey.trim(),
      enableVerification,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-100">AI & Solver Configuration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Vision & Solver Engine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('groq')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  provider === 'groq'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-sm">Groq (Auto-Failover)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Free 1,000 RPM + 3-Key Redundancy</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('demo')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  provider === 'demo'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-sm">Demo Mode</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Zero cost mock MCQs</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  provider === 'gemini'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-sm">Google Gemini</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Flash 1.5/2.0 Vision (Free)</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  provider === 'openai'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-sm">OpenAI</div>
                <div className="text-[11px] text-slate-400 mt-0.5">GPT-4o-mini Vision</div>
              </button>
            </div>
          </div>

          {/* GROQ 3-TIER REDUNDANCY SETUP */}
          {provider === 'groq' && (
            <div className="space-y-4 pt-1">
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90 leading-relaxed">
                  <strong>3-Tier Exam Redundancy</strong>: If Groq Key 1 hits the rate limit in any minute, the app auto-switches to Groq Key 2 instantly. If both fail, it seamlessly falls back to Gemini.
                </div>
              </div>

              {/* Key 1 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Groq Key #1 (Primary)
                  </label>
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                  >
                    Get free Groq key &rarr;
                  </a>
                </div>
                <input
                  type="password"
                  value={groqKey1}
                  onChange={(e) => setGroqKey1(e.target.value)}
                  placeholder="gsk_... (Primary Key)"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>

              {/* Key 2 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Groq Key #2 (Backup / Auto-Failover)
                  </label>
                  <span className="text-[11px] text-slate-400">Auto-switches on 429 quota</span>
                </div>
                <input
                  type="password"
                  value={groqKey2}
                  onChange={(e) => setGroqKey2(e.target.value)}
                  placeholder="gsk_... (Optional Backup Key from 2nd account)"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>

              {/* Key 3: Gemini Fallback */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Google Gemini Key (Emergency Backup #3)
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    Get free Gemini key &rarr;
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (Emergency Fallback)"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>
            </div>
          )}

          {/* SINGLE PROVIDER INPUTS FOR GEMINI / OPENAI */}
          {provider === 'gemini' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Google Gemini API Key</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  Get free Gemini key &rarr;
                </a>
              </div>
              <input
                type="password"
                value={geminiKey || apiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setApiKey(e.target.value);
                }}
                placeholder="AIzaSy..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          )}

          {provider === 'openai' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>OpenAI API Key</span>
                </label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  Get OpenAI key &rarr;
                </a>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          )}

          {/* Dual Verification Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-200">Dual-Pass Verification</div>
                <div className="text-xs text-slate-400">
                  Performs an independent verification check to flag discrepancies
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableVerification}
                onChange={(e) => setEnableVerification(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
