import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, Radio, Sparkles } from 'lucide-react';
import { createCameraManager, processFileInput, requestScreenWakeLock } from '../lib/camera.js';

interface Props {
  sessionId: string;
}

export const PhoneCameraView: React.FC<Props> = ({ sessionId }) => {
  const [cameraState, setCameraState] = useState<'OFF' | 'STARTING' | 'ACTIVE' | 'ERROR'>('OFF');
  const [isCapturing, setIsCapturing] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [lastShotNotice, setLastShotNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraManagerRef = useRef(createCameraManager());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastCaptureTimeRef = useRef(0);

  // Capture current frame from continuous camera without stopping
  const doCapture = useCallback(async (source: 'desktop' | 'phone') => {
    if (!videoRef.current || cameraState !== 'ACTIVE' || isCapturing) return;

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < 1500) {
      return;
    }
    lastCaptureTimeRef.current = now;

    setIsCapturing(true);
    // Visual shutter flash effect
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    try {
      const imageBase64 = await cameraManagerRef.current.captureWithoutStop(videoRef.current);
      setLastShotNotice(source === 'desktop' ? '📸 Captured by Desktop Shutter!' : '📸 Captured from Phone!');

      const res = await fetch(`/api/sessions/${sessionId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || 'Failed to upload photo.');
      }

      // Auto-clear notification after 3 seconds
      setTimeout(() => setLastShotNotice(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to capture frame.');
    } finally {
      setIsCapturing(false);
    }
  }, [cameraState, isCapturing, sessionId]);

  const doCaptureRef = useRef(doCapture);
  useEffect(() => {
    doCaptureRef.current = doCapture;
  });

  // Connect WebSocket for remote desktop shutter trigger (lifecycle tied only to sessionId)
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?session=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      fetch(`/api/sessions/${sessionId}/phone-connect`, { method: 'POST' }).catch(() => {});
      if (cameraState === 'ACTIVE') {
        ws.send(JSON.stringify({ type: 'CAMERA_STATUS', cameraActive: true }));
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'REMOTE_TRIGGER_CAPTURE') {
          // Desktop pressed "CLICK PHOTO"!
          doCaptureRef.current('desktop');
        }
      } catch (e) {
        console.error('Error handling WS in phone:', e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'CAMERA_STATUS', cameraActive: false }));
      }
      ws.close();
    };
  }, [sessionId]);

  // Sync camera active status when cameraState changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CAMERA_STATUS',
        cameraActive: cameraState === 'ACTIVE'
      }));
    }
  }, [cameraState]);

  // Clean up wake lock and camera stream
  useEffect(() => {
    return () => {
      cameraManagerRef.current.stop();
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  const handleStartContinuousCamera = async () => {
    setErrorMessage(null);
    setCameraState('STARTING');

    try {
      if (!videoRef.current) {
        throw new Error('Video preview element not ready.');
      }
      await cameraManagerRef.current.start(videoRef.current);
      setCameraState('ACTIVE');

      // Request screen wake-lock
      wakeLockRef.current = await requestScreenWakeLock();

      // Notify WebSocket that camera is continuously ready
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'CAMERA_STATUS', cameraActive: true }));
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraState('OFF');
      setErrorMessage(
        err?.message || 'Could not open camera. If you are accessing via Wi-Fi IP on HTTP, mobile browsers disable live webcam access. Use the "Snap Photo" fallback below.'
      );
    }
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    try {
      const imageBase64 = await processFileInput(file);
      setLastShotNotice('📸 Photo uploaded!');

      const res = await fetch(`/api/sessions/${sessionId}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || 'Failed to upload photo.');
      }
      setTimeout(() => setLastShotNotice(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process selected photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto select-none relative">
      {/* Screen Shutter Flash Overlay */}
      {shutterFlash && (
        <div className="fixed inset-0 bg-white z-50 pointer-events-none animate-out fade-out duration-150"></div>
      )}

      {/* Top Header */}
      <div className="text-center pt-2 pb-3 border-b border-slate-800/80">
        <div className="inline-flex items-center gap-1.5 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Continuous MCQ Remote Lens</span>
        </div>
        <h1 className="text-xl font-black text-white tracking-wide">PHONE CAMERA</h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-400">Session:</span>
          <span className="font-mono text-sm font-bold bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800 text-indigo-400">
            {sessionId}
          </span>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col items-center justify-center my-3 w-full">
        {/* State: CAMERA OFF */}
        {cameraState === 'OFF' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-full aspect-[4/3] rounded-3xl bg-slate-900 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center shadow-inner">
              <Camera className="w-12 h-12 text-slate-600 mb-3" />
              <div className="text-base font-bold text-slate-300">CONTINUOUS CAMERA OFF</div>
              <p className="text-xs text-slate-500 max-w-[240px] mt-1.5 leading-relaxed">
                Tap below to turn ON the camera continuously. Once active, you can trigger photos straight from your desktop monitor!
              </p>
            </div>

            <button
              onClick={handleStartContinuousCamera}
              className="mt-6 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-lg shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-6 h-6" />
              <span>START CONTINUOUS CAMERA</span>
            </button>

            {/* Native OS Camera Fallback */}
            <div className="mt-4 w-full text-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-400 underline hover:text-slate-200 transition-colors py-1"
              >
                Or snap photo using native camera
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileCapture}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* State: STARTING */}
        {cameraState === 'STARTING' && (
          <div className="w-full aspect-[4/3] rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-3" />
            <div className="text-sm font-semibold text-slate-300">Starting Continuous Camera...</div>
          </div>
        )}

        {/* State: ACTIVE CAMERA PREVIEW */}
        <div className={`w-full flex flex-col items-center ${cameraState === 'ACTIVE' ? 'block' : 'hidden'}`}>
          {/* Status pill indicating remote control ready */}
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>REMOTE SHUTTER READY</span>
            </div>
            <span className="text-[11px] text-slate-400">Aim at Laptop MCQ</span>
          </div>

          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-black border-2 border-emerald-500/50 shadow-2xl">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            {/* Viewfinder Target Overlays */}
            <div className="absolute inset-4 border border-white/30 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-5 h-5 border-t-2 border-l-2 border-emerald-400"></div>
                <div className="w-5 h-5 border-t-2 border-r-2 border-emerald-400"></div>
              </div>
              <div className="text-center text-[10px] text-white/80 bg-black/50 backdrop-blur-sm py-1 px-3 rounded-full mx-auto font-medium">
                Prop phone pointing at laptop screen
              </div>
              <div className="flex justify-between">
                <div className="w-5 h-5 border-b-2 border-l-2 border-emerald-400"></div>
                <div className="w-5 h-5 border-b-2 border-r-2 border-emerald-400"></div>
              </div>
            </div>

            {/* Capturing Indicator */}
            {isCapturing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center">
                <UploadCloud className="w-12 h-12 text-white animate-bounce mb-2" />
                <span className="text-sm font-bold text-white">Sending to Desktop...</span>
              </div>
            )}
          </div>

          {/* Last shot alert notice */}
          {lastShotNotice && (
            <div className="mt-3 w-full py-2 px-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{lastShotNotice}</span>
            </div>
          )}

          {/* Local button on phone as secondary option */}
          <button
            onClick={() => doCapture('phone')}
            disabled={isCapturing}
            className="mt-4 w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>📸 CLICK PHOTO (FROM PHONE)</span>
          </button>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Or simply click <strong>"CLICK PHOTO"</strong> on your desktop monitor!
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center pb-2">
        <p className="text-[11px] text-slate-500">
          Continuous Lens Mode • Screen kept awake while camera is active
        </p>
      </div>
    </div>
  );
};
