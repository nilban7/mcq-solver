import { describe, it, expect } from 'vitest';
import { solveMcq, parseModelJson } from '../server/aiSolver.js';

describe('AI Solver & Parser', () => {
  it('parses clean JSON string', () => {
    const raw = JSON.stringify({
      question: 'What is 2+2?',
      options: { A: '3', B: '4', C: '5', D: '6' },
      answer: 'B',
      confidence: 0.99,
      explanation: 'Basic arithmetic',
    });
    const parsed = parseModelJson(raw);
    expect(parsed.answer).toBe('B');
    expect(parsed.options.B).toBe('4');
  });

  it('parses markdown-fenced JSON string', () => {
    const markdown = '```json\n{"question": "Capital of Germany?", "options": {"A": "Munich", "B": "Berlin", "C": "Hamburg", "D": "Bonn"}, "answer": "B", "confidence": 0.95, "explanation": "Berlin is capital"}\n```';
    const parsed = parseModelJson(markdown);
    expect(parsed.answer).toBe('B');
    expect(parsed.options.B).toBe('Berlin');
  });

  it('runs demo mode successfully and returns structured result', async () => {
    const dummyImage = 'data:image/jpeg;base64,' + 'A'.repeat(3000);
    const result = await solveMcq(dummyImage, { provider: 'demo' });

    expect(result.question).toBeDefined();
    expect(result.options).toBeDefined();
    expect(['A', 'B', 'C', 'D']).toContain(result.answer);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.verificationStatus).toBe('VERIFIED');
    expect(result.explanation.length).toBeGreaterThan(5);
  });

  it('tracks key rate-limit cooldown and recovery correctly', async () => {
    const { isKeyCoolingDown, markKeyRateLimited } = await import('../server/aiSolver.js');
    expect(isKeyCoolingDown('test-key-123')).toBe(false);
    markKeyRateLimited('test-key-123', 500);
    expect(isKeyCoolingDown('test-key-123')).toBe(true);
    await new Promise((r) => setTimeout(r, 600));
    expect(isKeyCoolingDown('test-key-123')).toBe(false);
  });

  it('throws helpful error when groq keys are missing', async () => {
    const dummyImage = 'data:image/jpeg;base64,' + 'A'.repeat(3000);
    await expect(solveMcq(dummyImage, { provider: 'groq' })).rejects.toThrow('API key is missing');
  });
});
