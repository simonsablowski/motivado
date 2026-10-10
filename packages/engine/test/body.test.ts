import { describe, expect, it } from 'vitest';
import { bmi, bmiBand, dieterCategory, energyDemand, parseNumber, parseSex } from '../src';

describe('body measures', () => {
  it('parses German numbers', () => {
    expect(parseNumber('72,5')).toBe(72.5);
    expect(parseNumber(' 180 ')).toBe(180);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
  });

  it('normalises gender values used in the models', () => {
    expect(parseSex('f')).toBe('f');
    expect(parseSex('Frau')).toBe('f');
    expect(parseSex('Herr')).toBe('m');
    expect(parseSex('x')).toBeUndefined();
  });

  it('computes BMI and bands at the boundaries', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 2);
    expect(bmiBand(24.9)).toBe('A');
    expect(bmiBand(25)).toBe('B');
    expect(bmiBand(30)).toBe('C');
    expect(bmiBand(35)).toBe('D');
  });

  it('builds the category code', () => {
    expect(dieterCategory(80, 180, 'f')).toBe('A1');
    expect(dieterCategory(100, 175, 'm')).toBe('C2');
  });

  it('computes energy demand (Mifflin-St Jeor)', () => {
    // woman, 70 kg, 165 cm, 35 y: 10*70 + 6.25*165 - 5*35 - 161 = 1395.25
    const r = energyDemand({ weightKg: 70, heightCm: 165, age: 35, sex: 'f', activity: 1.4 });
    expect(r.basal).toBe(1395);
    expect(r.total).toBe(1953);
    expect(r.target).toBeUndefined();
  });

  it('subtracts the planned loss but never goes below the basal rate', () => {
    const base = { weightKg: 70, heightCm: 165, age: 35, sex: 'f' as const, activity: 1.4 };
    expect(energyDemand({ ...base, lossGramsPerWeek: 500 }).target).toBe(1953 - 500);
    expect(energyDemand({ ...base, lossGramsPerWeek: 1000 }).target).toBe(1395 + 0 > 953 ? 1395 : 953);
  });
});
