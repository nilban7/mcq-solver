import { describe, it, expect } from 'vitest';
import { validateBase64Image } from '../server/imageCheck.js';

describe('Image Quality Check', () => {
  it('rejects empty or null input', () => {
    // @ts-expect-error test invalid input
    expect(validateBase64Image(null).valid).toBe(false);
    expect(validateBase64Image('').valid).toBe(false);
  });

  it('rejects unsupported image format', () => {
    const res = validateBase64Image('data:text/plain;base64,SGVsbG8gV29ybGQ=');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unsupported format');
  });

  it('rejects overly small / blank payload (< 2KB)', () => {
    const tinyBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(50);
    const res = validateBase64Image(tinyBase64);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('too small');
  });

  it('accepts valid JPEG data with reasonable size', () => {
    // 4000 base64 chars is ~3KB
    const validBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
    const res = validateBase64Image(validBase64);
    expect(res.valid).toBe(true);
  });
});
