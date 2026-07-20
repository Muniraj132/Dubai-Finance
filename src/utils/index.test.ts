import { describe, it, expect } from 'vitest';
import { convertToAED, convertToINR, getMonthKey } from './index';

describe('currency conversion', () => {
  it('returns AED amounts unchanged', () => {
    expect(convertToAED(100, 'AED', 22.5)).toBe(100);
  });

  it('converts INR to AED using the given rate', () => {
    expect(convertToAED(2250, 'INR', 22.5)).toBe(100);
  });

  it('converts AED to INR using the given rate', () => {
    expect(convertToINR(100, 'AED', 22.5)).toBe(2250);
  });
});

describe('getMonthKey', () => {
  it('extracts the YYYY-MM prefix from an ISO date string', () => {
    expect(getMonthKey('2026-07-20')).toBe('2026-07');
  });
});
