import { describe, it, expect } from 'vitest';
import { convertToAED, convertToINR, getMonthKey, computeSipStats, isSipHolding } from './index';
import type { Investment, InvestmentTransaction } from '../types';

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

const inv = (over: Partial<Investment>): Investment => ({
  id: 'i1', type: 'Mutual Fund', name: 'Fund', currency: 'INR', currentValue: 0,
  maturityDate: null, interestRate: null, schemeCode: null,
  sipEnabled: false, sipAmount: null, sipDay: null, sipLastRunDate: null,
  status: 'active', notes: '', createdAt: '2026-01-01', ...over,
});

const txn = (over: Partial<InvestmentTransaction>): InvestmentTransaction => ({
  id: 't1', investment_id: 'i1', type: 'SIP', date: '2026-01-05', units: null, pricePerUnit: null,
  amount: 0, currency: 'INR', notes: '', createdAt: '2026-01-05', ...over,
});

describe('isSipHolding', () => {
  it('is true when the holding is set up as a SIP', () => {
    expect(isSipHolding(inv({ sipEnabled: true }))).toBe(true);
  });

  it('is false for a holding that only has hand-logged SIP transactions', () => {
    expect(isSipHolding(inv({ type: 'PPF', sipEnabled: false }))).toBe(false);
  });
});

describe('computeSipStats', () => {
  it('sums SIP transactions of SIP holdings only, using frozen snapshot values when present', () => {
    const stats = computeSipStats([
      inv({ id: 'sip', sipEnabled: true }),
      inv({ id: 'ppf', type: 'PPF', sipEnabled: false }),
    ], [
      txn({ id: 'a', investment_id: 'sip', type: 'SIP', amount: 100, currency: 'AED', amountAed: 100, amountInr: 2200 }),
      txn({ id: 'b', investment_id: 'sip', type: 'SIP', amount: 2300, currency: 'INR' }),
      txn({ id: 'c', investment_id: 'sip', type: 'Buy', amount: 9999, currency: 'INR' }),
      txn({ id: 'd', investment_id: 'ppf', type: 'SIP', amount: 2000, currency: 'INR' }),
    ], 23);
    expect(stats.totalInr).toBe(4500);
    expect(stats.totalAed).toBe(200);
  });
  it('counts monthly commitment for active auto-SIPs only', () => {
    const stats = computeSipStats([
      inv({ id: 'x', sipEnabled: true, sipAmount: 5000, currency: 'INR' }),
      inv({ id: 'y', sipEnabled: true, sipAmount: 100, currency: 'AED' }),
      inv({ id: 'z', sipEnabled: true, sipAmount: 1000, status: 'closed' }),
      inv({ id: 'w', sipEnabled: false, sipAmount: 1000 }),
    ], [], 23);
    expect(stats.activeCount).toBe(2);
    expect(stats.monthlyInr).toBe(7300);
  });
});
