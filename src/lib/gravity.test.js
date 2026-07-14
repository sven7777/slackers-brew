import { describe, it, expect } from 'vitest';
import { fmtGravity, computeAbv } from './gravity';

describe('fmtGravity', () => {
  it('pads to 3 decimal places', () => {
    expect(fmtGravity(1.06)).toBe('1.060');
    expect(fmtGravity(1.012)).toBe('1.012');
    expect(fmtGravity(1.1)).toBe('1.100');
  });

  it('passes null/undefined through as null', () => {
    expect(fmtGravity(null)).toBeNull();
    expect(fmtGravity(undefined)).toBeNull();
  });
});

describe('computeAbv', () => {
  it('applies (OG − FG) × 131.25, rounded to 1 decimal', () => {
    expect(computeAbv(1.06, 1.012)).toBe(6.3);
    expect(computeAbv(1.05, 1.01)).toBe(5.3); // 5.25 rounds up
    expect(computeAbv(1.048, 1.048)).toBe(0);
  });

  it('returns null when either gravity is missing', () => {
    expect(computeAbv(null, 1.012)).toBeNull();
    expect(computeAbv(1.06, null)).toBeNull();
    expect(computeAbv(null, null)).toBeNull();
  });
});
