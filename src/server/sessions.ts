import { SessionState } from '../shared/types.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid 0, O, 1, I for ease of manual typing
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private listeners: Map<string, Set<(session: SessionState) => void>> = new Map();

  constructor() {
    // Periodic cleanup of expired sessions
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  generateSessionId(): string {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    // Ensure uniqueness
    if (this.sessions.has(code)) {
      return this.generateSessionId();
    }
    return code;
  }

  createSession(): SessionState {
    const id = this.generateSessionId();
    const now = Date.now();
    const session: SessionState = {
      id,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
      phoneConnected: false,
      status: 'WAITING_FOR_PHONE',
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): SessionState | null {
    const s = this.sessions.get(id.toUpperCase());
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(id.toUpperCase());
      return null;
    }
    return s;
  }

  updateSession(id: string, updates: Partial<SessionState>): SessionState | null {
    const session = this.getSession(id);
    if (!session) return null;

    Object.assign(session, updates);
    this.notify(session.id, session);
    return session;
  }

  onUpdate(id: string, callback: (session: SessionState) => void) {
    const code = id.toUpperCase();
    if (!this.listeners.has(code)) {
      this.listeners.set(code, new Set());
    }
    this.listeners.get(code)!.add(callback);

    return () => {
      this.listeners.get(code)?.delete(callback);
    };
  }

  private notify(id: string, session: SessionState) {
    const code = id.toUpperCase();
    const callbacks = this.listeners.get(code);
    if (callbacks) {
      callbacks.forEach((cb) => cb(session));
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now > s.expiresAt) {
        this.sessions.delete(id);
        this.listeners.delete(id);
      }
    }
  }
}

export const sessionManager = new SessionManager();
