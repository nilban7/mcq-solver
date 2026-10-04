import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SessionState, HistoryItem, McqOptionKey } from '../../shared/types.js';
import { SessionQR } from './SessionQR.js';
import { BigAnswerCard } from './BigAnswerCard.js';
import { HistoryTable } from './HistoryTable.js';
import { SettingsModal, AppSettings } from './SettingsModal.js';
import { ManualOverrideModal } from './ManualOverrideModal.js';
import { db } from '../lib/db.js';
import { Sparkles, Settings, Plus, RotateCcw, AlertOctagon, Radio, Camera, Play, CheckCircle2, Smartphone, RefreshCw } from 'lucide-react';

export const DesktopView: React.FC = () => {
  const [session, setSession] = useState<SessionState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideItem, setOverrideItem] = useState<HistoryItem | null>(null);
  const [currentOverride, setCurrentOverride] = useState<McqOptionKey | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Settings in localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mcq_solver_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      provider: 'groq',
      apiKey: '',
      groqKey1: '',
      groqKey2: '',
      geminiKey: '',
      enableVerification: true,
    };
  });

  // Load history from IndexedDB on startup
  useEffect(() => {
    db.history.reverse().toArray().then((items) => {
      setHistory(items);
    });
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('mcq_solver_settings', JSON.stringify(newSettings));
    if (session?.id) {
      fetch(`/api/sessions/${session.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      }).catch(() => {});
    }
  };

  // Create session
  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      setSession(data);
      setCurrentOverride(null);
      // Sync solver config
      fetch(`/api/sessions/${data.id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to create session:', err);
      alert('Failed to create session. Please check if the server is running.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Connect WebSocket when session is active
  useEffect(() => {
    if (!session?.id) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?session=${session.id}`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'SESSION_UPDATE' || msg.type === 'SESSION_STATE') {
            const updated: SessionState = msg.session;
            setSession(updated);

            // Auto-save verified answer to IndexedDB
            if (updated.status === 'ANSWER_READY' && updated.currentResult) {
              const res = updated.currentResult;
              const newItem: HistoryItem = {
                timestamp: Date.now(),
                question: res.question,
                options: res.options,
                aiAnswer: res.answer,
                finalAnswer: res.answer,
                confidence: res.confidence,
                verificationStatus: res.verificationStatus,
                explanation: res.explanation,
              };

              const existing = await db.history.where('question').equals(res.question).first();
              if (!existing) {
                const id = await db.history.add(newItem);
                newItem.id = Number(id);
                setHistory((prev) => [newItem, ...prev]);
              }
            }
          }
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [session?.id]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Remote Shutter: Click Photo on Desktop -> sends signal to Phone
  const handleClickPhotoFromDesktop = useCallback(async () => {
    if (!session?.id || isTriggering || session?.status === 'ANALYZING') return;

    setIsTriggering(true);
    setCurrentOverride(null);

    const currentSettings = settingsRef.current;

    // Send single trigger signal to prevent duplicate captures
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'REMOTE_TRIGGER_CAPTURE' }));
    } else {
      // Fallback to REST trigger only if WebSocket is disconnected
      try {
        await fetch(`/api/sessions/${session.id}/trigger-capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings),
        });
      } catch (e) {
        console.warn('REST trigger fallback warning:', e);
      }
    }

    setTimeout(() => setIsTriggering(false), 1200);
  }, [session?.id, session?.status, isTriggering]);

  // Spacebar keyboard shortcut for instant capture from desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or modal is open
      if (isSettingsOpen || isOverrideOpen) return;
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' && session?.id) {
        e.preventDefault();
        handleClickPhotoFromDesktop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session?.id, isSettingsOpen, isOverrideOpen, handleClickPhotoFromDesktop]);

  // Re-solve handler
  const handleResolve = async () => {
    if (!session?.id) return;
    setIsResolving(true);
    try {
      await fetch(`/api/sessions/${session.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          enableVerification: settings.enableVerification,
        }),
      });
    } catch (e) {
      console.error('Failed to re-solve:', e);
    } finally {
      setIsResolving(false);
    }
  };

  // Simulate capture directly from desktop for demo/testing
  const handleSimulateCapture = async () => {
    if (!session?.id) return;
    setCurrentOverride(null);
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await fetch(`/api/sessions/${session.id}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: dummyImage,
        provider: settings.provider,
        apiKey: settings.apiKey,
        enableVerification: settings.enableVerification,
      }),
    });
  };

  // Save manual override
  const handleSaveOverride = async (selected: McqOptionKey) => {
    setCurrentOverride(selected);
    if (session?.currentResult) {
      const q = session.currentResult.question;
      const existing = await db.history.where('question').equals(q).first();
      if (existing && existing.id) {
        await db.history.update(existing.id, {
          finalAnswer: selected,
          isOverridden: true,
        });
        setHistory((prev) =>
          prev.map((item) =>
            item.id === existing.id
              ? { ...item, finalAnswer: selected, isOverridden: true }
              : item
          )
        );
      }
    }
  };

  const handleClearHistory = async () => {
    await db.history.clear();
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">Instant MCQ Solver</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  settings.provider === 'demo'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                }`}>
                  {settings.provider === 'demo' ? 'DEMO MODE' : settings.provider.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Continuous Camera Lens • Desktop Remote Shutter</p>
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 border-r border-slate-800 pr-4 mr-1">
              <div>
                Questions Solved: <span className="font-bold text-slate-200">{history.length}</span>
              </div>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs transition-colors cursor-pointer"
              title="Click to configure AI Solver & Keys"
            >
              <span className="text-slate-400">AI Engine:</span>
              <span className={`font-bold ${settings.provider === 'groq' ? 'text-amber-400' : settings.provider === 'gemini' ? 'text-indigo-400' : settings.provider === 'openai' ? 'text-blue-400' : 'text-emerald-400'}`}>
                {settings.provider === 'groq' ? 'Groq (Auto-Failover 3-Key)' : settings.provider === 'gemini' ? 'Google Gemini' : settings.provider === 'openai' ? 'OpenAI GPT-4o' : 'Demo Mode'}
              </span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
              title="Solver Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {session ? (
              <button
                onClick={handleCreateSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {!session ? (
          /* CREATE SESSION HERO */
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/10">
              <Camera className="w-10 h-10 text-indigo-400" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight max-w-2xl">
              Solve Screen MCQs with Remote Desktop Shutter
            </h1>
            <p className="text-sm md:text-base text-slate-400 max-w-lg mt-3 leading-relaxed">
              Prop your phone facing the laptop screen once. Then sit back and click <strong className="text-slate-200">"CLICK PHOTO"</strong> right from your desktop monitor to print answers!
            </p>

            <button
              onClick={handleCreateSession}
              disabled={isCreatingSession}
              className="mt-8 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-lg shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <Plus className="w-6 h-6" />
              <span>{isCreatingSession ? 'Creating...' : 'CREATE SESSION'}</span>
            </button>
          </div>
        ) : (
          /* ACTIVE SESSION CONTAINER */
          <div className="flex flex-col gap-6">
            {/* Top Bar for active session */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Session:</span>
                <span className="font-mono text-base font-black text-indigo-400 tracking-wider bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                  {session.id}
                </span>

                {/* Continuous Camera Status indicator */}
                {session.cameraActive ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>PHONE CAMERA CONTINUOUSLY ON</span>
                  </div>
                ) : session.phoneConnected ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>PHONE CONNECTED (Start camera on phone)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span>Waiting for phone scan...</span>
                  </div>
                )}
              </div>

              {/* Shutter & Demo Buttons */}
              <div className="flex items-center gap-2">
                {/* PRIMARY DESKTOP SHUTTER BUTTON */}
                <button
                  onClick={handleClickPhotoFromDesktop}
                  disabled={isTriggering || session.status === 'ANALYZING'}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-lg ${
                    session.status === 'ANALYZING'
                      ? 'bg-amber-500/80 text-slate-950 cursor-not-allowed opacity-90'
                      : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-500/30 disabled:opacity-50'
                  }`}
                  title="Capture current MCQ from laptop screen"
                >
                  {session.status === 'ANALYZING' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>SOLVING MCQ...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>📸 CLICK PHOTO</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/20 text-slate-900 font-mono ml-0.5">
                        Space
                      </span>
                    </>
                  )}
                </button>

                {session.currentResult && (
                  <button
                    onClick={() => setShowQrCode(!showQrCode)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors"
                    title="Toggle QR Code"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{showQrCode ? 'Hide QR' : 'Show QR'}</span>
                  </button>
                )}

                <button
                  onClick={handleSimulateCapture}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors"
                  title="Simulate capture without phone"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-300" />
                  <span>Demo Simulate</span>
                </button>
              </div>
            </div>

            {/* Dynamic View based on status */}
            {session.status === 'ANALYZING' ? (
              <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                  <Sparkles className="w-8 h-8 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-wide">ANALYZING QUESTION...</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Photo received from phone! Extracting MCQ text and solving answer...
                </p>
              </div>
            ) : (session.currentResult && !showQrCode) ? (
              <BigAnswerCard
                result={session.currentResult}
                overrideAnswer={currentOverride}
                onOpenOverride={() => setIsOverrideOpen(true)}
                onResolve={handleResolve}
                onClickPhoto={handleClickPhotoFromDesktop}
                isResolving={isResolving}
              />
            ) : session.status === 'ERROR' && !session.currentResult ? (
              <div className="max-w-md mx-auto w-full p-8 rounded-3xl bg-rose-950/40 border border-rose-500/40 text-center animate-in fade-in">
                <AlertOctagon className="w-14 h-14 text-rose-400 mx-auto mb-4" />
                <h2 className="text-xl font-black text-rose-300">CAPTURE ISSUE</h2>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  {session.lastError || 'Image was blurry or unreadable. Please aim phone at the MCQ and click photo again.'}
                </p>
                <button
                  onClick={handleClickPhotoFromDesktop}
                  className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/30"
                >
                  📸 CLICK PHOTO AGAIN
                </button>
              </div>
            ) : (
              /* WAITING FOR PHONE / QR SCREEN */
              <div className="flex flex-col items-center py-6">
                <SessionQR
                  sessionId={session.id}
                  phoneConnected={session.phoneConnected || session.status === 'PHONE_CONNECTED'}
                />
              </div>
            )}
          </div>
        )}

        {/* History Table */}
        <section className="mt-4">
          <HistoryTable
            history={history}
            onClearHistory={handleClearHistory}
            onOverrideItem={(item) => {
              setOverrideItem(item);
              setIsOverrideOpen(true);
            }}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        Instant MCQ Solver • Remote Shutter Mode • Answers displayed exclusively on desktop monitor.
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={settings}
        onSave={handleSaveSettings}
      />

      <ManualOverrideModal
        isOpen={isOverrideOpen}
        onClose={() => {
          setIsOverrideOpen(false);
          setOverrideItem(null);
        }}
        currentAnswer={overrideItem ? overrideItem.finalAnswer : currentOverride || session?.currentResult?.answer || null}
        aiAnswer={overrideItem ? overrideItem.aiAnswer : session?.currentResult?.answer || null}
        options={overrideItem ? overrideItem.options : session?.currentResult?.options || { A: '', B: '', C: '', D: '' }}
        onSaveOverride={(selected) => {
          if (overrideItem && overrideItem.id) {
            db.history.update(overrideItem.id, {
              finalAnswer: selected,
              isOverridden: true,
            });
            setHistory((prev) =>
              prev.map((item) =>
                item.id === overrideItem.id
                  ? { ...item, finalAnswer: selected, isOverridden: true }
                  : item
              )
            );
          } else {
            handleSaveOverride(selected);
          }
        }}
      />
    </div>
  );
};
