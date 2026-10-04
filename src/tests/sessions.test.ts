import { describe, it, expect } from 'vitest';
import { sessionManager } from '../server/sessions.js';

describe('Session Manager', () => {
  it('generates a 6-character alphanumeric code without ambiguous characters', () => {
    const code = sessionManager.generateSessionId();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(code).not.toContain('0');
    expect(code).not.toContain('O');
    expect(code).not.toContain('1');
    expect(code).not.toContain('I');
  });

  it('creates and retrieves a valid session', () => {
    const session = sessionManager.createSession();
    expect(session.id).toBeDefined();
    expect(session.status).toBe('WAITING_FOR_PHONE');
    expect(session.phoneConnected).toBe(false);

    const fetched = sessionManager.getSession(session.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(session.id);
  });

  it('updates session status and notifies listeners', () => {
    const session = sessionManager.createSession();
    let notified = false;

    sessionManager.onUpdate(session.id, (updated) => {
      if (updated.status === 'PHONE_CONNECTED') {
        notified = true;
      }
    });

    sessionManager.updateSession(session.id, {
      status: 'PHONE_CONNECTED',
      phoneConnected: true,
    });

    expect(notified).toBe(true);
    const updated = sessionManager.getSession(session.id);
    expect(updated?.phoneConnected).toBe(true);
    expect(updated?.status).toBe('PHONE_CONNECTED');
  });
});
