import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Copy, Check, ExternalLink, Wifi, ShieldAlert } from 'lucide-react';

interface Props {
  sessionId: string;
  phoneConnected: boolean;
}

export const SessionQR: React.FC<Props> = ({ sessionId, phoneConnected }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [customHost, setCustomHost] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch local LAN IPs from server on mount
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.addresses && data.addresses.length > 0) {
          setNetworkIps(data.addresses);
          // If desktop is currently on localhost, select the LAN IP automatically!
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setSelectedHost(data.preferredIp);
          } else {
            setSelectedHost(window.location.hostname);
          }
        } else {
          setSelectedHost(window.location.hostname);
        }
      })
      .catch(() => {
        setSelectedHost(window.location.hostname);
      });
  }, []);

  // Compute the URL that the phone will open
  const hostToUse = customHost.trim() || selectedHost || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' ? (window.location.port ? `:${window.location.port}` : '') : ':3000';

  const cameraUrl = customHost.startsWith('http://') || customHost.startsWith('https://')
    ? `${customHost.replace(/\/$/, '')}/camera?session=${sessionId}`
    : `${protocol}//${hostToUse}${port}/camera?session=${sessionId}`;

  // Render QR Code
  useEffect(() => {
    if (canvasRef.current && sessionId && cameraUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        cameraUrl,
        {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [sessionId, cameraUrl]);

  const copyUrl = () => {
    navigator.clipboard.writeText(cameraUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl backdrop-blur-md animate-in fade-in duration-300">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Smartphone className="w-5 h-5 text-indigo-400" />
        <span className="text-xs uppercase tracking-widest font-semibold text-slate-400">
          Pair Phone Remote Camera
        </span>
      </div>

      <div className="text-3xl font-black font-mono tracking-widest text-indigo-400 my-1">
        {sessionId}
      </div>

      {/* QR Code Canvas */}
      <div className="flex justify-center my-3">
        <div className="p-3 bg-white rounded-2xl shadow-xl inline-block border-4 border-indigo-500/20">
          <canvas ref={canvasRef} className="block w-52 h-52 rounded-xl" />
        </div>
      </div>

      {/* Connection Indicator */}
      <div className="my-2">
        {phoneConnected ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>PHONE CONNECTED ✓</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>Waiting for phone scan...</span>
          </div>
        )}
      </div>

      {/* Wi-Fi & URL notice */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium mt-2">
        <Wifi className="w-4 h-4 text-emerald-400" />
        <span>Ensure your phone is on the same Wi-Fi network</span>
      </div>

      <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed mt-1 mb-3">
        Scan the QR code with your phone camera, or open the link below directly in your phone browser:
      </p>

      {/* Copy link bar */}
      <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs mb-3">
        <span className="text-indigo-300 truncate max-w-[280px] font-mono font-medium">
          {cameraUrl}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={copyUrl}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            title="Copy URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={cameraUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
            title="Open camera page"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Security Tip for self-signed HTTPS */}
      <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-left text-[11px] text-slate-300 flex items-start gap-2.5 mb-3">
        <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="leading-snug">
          <strong className="text-indigo-200">First time scanning?</strong> If your mobile browser displays a <em>"Connection is not private"</em> warning, tap <strong>"Advanced"</strong> and then <strong>"Proceed to {hostToUse} (unsafe)"</strong>. This is normal for local dev HTTPS.
        </div>
      </div>

      {/* Advanced Network IP Switcher Toggle */}
      <div className="text-right">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[11px] text-slate-500 hover:text-slate-300 underline transition-colors"
        >
          {showAdvanced ? 'Hide Network Settings' : 'Change Wi-Fi IP / Tunnel URL'}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-3 p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-3 animate-in fade-in">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Detected Wi-Fi / LAN IP:
            </label>
            <select
              value={selectedHost}
              onChange={(e) => {
                setSelectedHost(e.target.value);
                setCustomHost('');
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {networkIps.map((ip) => (
                <option key={ip} value={ip}>
                  {ip} (Wi-Fi / Local Network)
                </option>
              ))}
              <option value="localhost">localhost (PC only)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Or Custom Public Tunnel (Cloudflare / Localtunnel / Ngrok):
            </label>
            <input
              type="text"
              placeholder="https://abc.trycloudflare.com or https://abc.loca.lt"
              value={customHost}
              onChange={(e) => setCustomHost(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
