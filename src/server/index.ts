import express, { Request, Response } from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { sessionManager } from './sessions.js';
import { validateBase64Image } from './imageCheck.js';
import { solveMcq } from './aiSolver.js';
import { SolverConfig } from '../shared/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
// 20MB limit for high-res camera captures
app.use(express.json({ limit: '20mb' }));

// REST Routes

// 0. Get local LAN IPs of this server
app.get('/api/network-info', (req: Request, res: Response) => {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Exclude internal (127.0.0.1) and non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  res.json({
    addresses,
    preferredIp: addresses[0] || 'localhost',
  });
});

// 1. Create a new session
app.post('/api/sessions', (req: Request, res: Response) => {
  const session = sessionManager.createSession();
  res.json(session);
});

// 2. Get session details
app.get('/api/sessions/:id', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  res.json(session);
});

// 3. Phone connects to session
app.post('/api/sessions/:id/phone-connect', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  sessionManager.updateSession(req.params.id, {
    phoneConnected: true,
    status: session.status === 'WAITING_FOR_PHONE' ? 'PHONE_CONNECTED' : session.status,
  });
  res.json({ success: true });
});

// 4. Update session solver configuration (from desktop)
app.post('/api/sessions/:id/config', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  const { provider, apiKey, groqKey1, groqKey2, geminiKey, enableVerification } = req.body;
  sessionManager.updateSession(req.params.id, {
    solverConfig: { provider, apiKey, groqKey1, groqKey2, geminiKey, enableVerification },
  });
  res.json({ success: true });
});

// 5. Remote shutter trigger from desktop
app.post('/api/sessions/:id/trigger-capture', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  // Update solver config if passed from desktop
  if (req.body.provider || req.body.apiKey || req.body.groqKey1 || req.body.groqKey2 || req.body.geminiKey) {
    sessionManager.updateSession(req.params.id, {
      solverConfig: {
        provider: req.body.provider,
        apiKey: req.body.apiKey,
        groqKey1: req.body.groqKey1,
        groqKey2: req.body.groqKey2,
        geminiKey: req.body.geminiKey,
        enableVerification: req.body.enableVerification,
      }
    });
  }

  // Broadcast REMOTE_TRIGGER_CAPTURE to all connected clients (specifically the phone)
  const sockets = sessionSockets.get(req.params.id.toUpperCase());
  if (sockets && sockets.size > 0) {
    const payload = JSON.stringify({ type: 'REMOTE_TRIGGER_CAPTURE' });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  res.json({ success: true, message: 'Shutter trigger sent to phone.' });
});

// Controller to discard stale asynchronous solver completions
const activeSolveRequests = new Map<string, number>();

// 6. Phone uploads captured photo
app.post('/api/sessions/:id/capture', async (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }

  const { imageBase64 } = req.body;
  const config: SolverConfig = session.solverConfig || { provider: 'demo' };
  const provider = req.body.provider || config.provider;
  const apiKey = req.body.apiKey || config.apiKey;
  const groqKey1 = req.body.groqKey1 || config.groqKey1;
  const groqKey2 = req.body.groqKey2 || config.groqKey2;
  const geminiKey = req.body.geminiKey || config.geminiKey;
  const enableVerification = req.body.enableVerification ?? config.enableVerification ?? true;

  // Validate image quality
  const validation = validateBase64Image(imageBase64);
  if (!validation.valid) {
    sessionManager.updateSession(req.params.id, {
      status: 'ERROR',
      lastError: validation.error || 'Invalid image captured. Please aim properly and click photo again.',
    });
    return res.status(400).json({ error: validation.error });
  }

  const requestId = Date.now();
  activeSolveRequests.set(req.params.id, requestId);

  // Update status to ANALYZING
  sessionManager.updateSession(req.params.id, {
    status: 'ANALYZING',
    lastImageBase64: imageBase64,
    lastError: undefined,
  });

  res.json({ success: true, message: 'Image received and analysis started.' });

  // Async solve pipeline
  try {
    const result = await solveMcq(imageBase64, {
      provider,
      apiKey,
      groqKey1,
      groqKey2,
      geminiKey,
      enableVerification: enableVerification ?? true,
    });

    // Guard: Only commit if this request is still the newest one for this session!
    if (activeSolveRequests.get(req.params.id) === requestId) {
      sessionManager.updateSession(req.params.id, {
        status: 'ANSWER_READY',
        currentResult: result,
        lastError: undefined,
      });
    } else {
      console.log(`[Solver] Dropping stale result for session ${req.params.id} (superseded by newer capture)`);
    }
  } catch (err: any) {
    if (activeSolveRequests.get(req.params.id) === requestId) {
      sessionManager.updateSession(req.params.id, {
        status: 'ERROR',
        lastError: err?.message || 'Failed to analyze MCQ image.',
      });
    }
  }
});

// 7. Re-solve existing image
app.post('/api/sessions/:id/resolve', async (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session || !session.lastImageBase64) {
    return res.status(400).json({ error: 'No image found in session to re-solve.' });
  }

  const config: SolverConfig = session.solverConfig || { provider: 'demo' };
  const provider = req.body.provider || config.provider;
  const apiKey = req.body.apiKey || config.apiKey;
  const groqKey1 = req.body.groqKey1 || config.groqKey1;
  const groqKey2 = req.body.groqKey2 || config.groqKey2;
  const geminiKey = req.body.geminiKey || config.geminiKey;
  const enableVerification = req.body.enableVerification ?? config.enableVerification ?? true;

  const requestId = Date.now();
  activeSolveRequests.set(req.params.id, requestId);

  sessionManager.updateSession(req.params.id, {
    status: 'ANALYZING',
    lastError: undefined,
  });

  res.json({ success: true });

  try {
    const result = await solveMcq(session.lastImageBase64, {
      provider,
      apiKey,
      groqKey1,
      groqKey2,
      geminiKey,
      enableVerification: enableVerification ?? true,
    });

    if (activeSolveRequests.get(req.params.id) === requestId) {
      sessionManager.updateSession(req.params.id, {
        status: 'ANSWER_READY',
        currentResult: result,
        lastError: undefined,
      });
    }
  } catch (err: any) {
    if (activeSolveRequests.get(req.params.id) === requestId) {
      sessionManager.updateSession(req.params.id, {
        status: 'ERROR',
        lastError: err?.message || 'Failed to re-solve question.',
      });
    }
  }
});

// WebSocket Server for Real-Time Sync & Remote Shutter
const sessionSockets: Map<string, Set<WebSocket>> = new Map();

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session')?.toUpperCase();

  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  if (!sessionSockets.has(sessionId)) {
    sessionSockets.set(sessionId, new Set());
  }
  sessionSockets.get(sessionId)!.add(ws);

  // Send initial session state
  const session = sessionManager.getSession(sessionId);
  if (session) {
    ws.send(JSON.stringify({ type: 'SESSION_STATE', session }));
  }

  // Handle incoming messages from clients
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // 1. Phone reports camera active or inactive
      if (msg.type === 'CAMERA_STATUS') {
        const current = sessionManager.getSession(sessionId);
        sessionManager.updateSession(sessionId, {
          cameraActive: !!msg.cameraActive,
          phoneConnected: true,
          status: (current && current.status === 'WAITING_FOR_PHONE' && msg.cameraActive)
            ? 'PHONE_CONNECTED'
            : current?.status || 'PHONE_CONNECTED',
        });
      }

      // 2. Desktop triggers remote shutter
      if (msg.type === 'REMOTE_TRIGGER_CAPTURE') {
        const sockets = sessionSockets.get(sessionId);
        if (sockets) {
          const payload = JSON.stringify({ type: 'REMOTE_TRIGGER_CAPTURE' });
          for (const client of sockets) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error handling WS client message:', e);
    }
  });

  ws.on('close', () => {
    sessionSockets.get(sessionId)?.delete(ws);
  });
});

// Broadcast sessionManager updates
const broadcastUpdate = (session: any) => {
  const sockets = sessionSockets.get(session.id.toUpperCase());
  if (sockets) {
    const payload = JSON.stringify({ type: 'SESSION_UPDATE', session });
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
};

const originalUpdate = sessionManager.updateSession.bind(sessionManager);
sessionManager.updateSession = (id: string, updates: any) => {
  const result = originalUpdate(id, updates);
  if (result) {
    broadcastUpdate(result);
  }
  return result;
};

// Serve compiled production frontend if dist directory exists
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response, next: any) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// In dev (npm run dev:all / server), use 3001 so Vite can use 3000. In production / cloud, default to 3000 or process.env.PORT.
const isDevServer = process.env.npm_lifecycle_event === 'server' || process.env.npm_lifecycle_event === 'dev:all';
const PORT = process.env.PORT || (isDevServer ? 3001 : 3000);

server.listen(PORT, () => {
  console.log(`⚡ MCQ Solver Server running on http://localhost:${PORT} (Mode: ${isDevServer ? 'Development' : 'Production/Standalone'})`);
});
