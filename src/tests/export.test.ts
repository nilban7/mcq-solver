import { describe, it, expect } from 'vitest';
import { HistoryItem } from '../shared/types.js';

describe('Export Data Formatting', () => {
  it('correctly structures CSV rows with quotes escaping', () => {
    const items: HistoryItem[] = [
      {
        timestamp: 1710000000000,
        question: 'What is the "speed" of light?',
        options: { A: '3x10^8 m/s', B: '3x10^6 m/s', C: '100 m/s', D: 'Zero' },
        aiAnswer: 'A',
        finalAnswer: 'A',
        confidence: 0.98,
        verificationStatus: 'VERIFIED',
        explanation: 'Standard physical constant',
      },
      {
        timestamp: 1710000050000,
        question: 'Which element has symbol Fe?',
        options: { A: 'Lead', B: 'Gold', C: 'Iron', D: 'Copper' },
        aiAnswer: 'C',
        finalAnswer: 'C',
        confidence: 0.95,
        verificationStatus: 'VERIFIED',
        explanation: 'From Latin Ferrum',
        isOverridden: true,
      },
    ];

    const rows = items.map((item, idx) => [
      idx + 1,
      `"${(item.question || '').replace(/"/g, '""')}"`,
      item.aiAnswer || 'N/A',
      item.finalAnswer || 'N/A',
      `${Math.round(item.confidence * 100)}%`,
      item.isOverridden ? 'Manually Corrected' : item.verificationStatus,
    ]);

    expect(rows).toHaveLength(2);
    // Verified double quotes escaping
    expect(rows[0][1]).toBe('"What is the ""speed"" of light?"');
    expect(rows[0][3]).toBe('A');
    expect(rows[1][5]).toBe('Manually Corrected');
  });
});
