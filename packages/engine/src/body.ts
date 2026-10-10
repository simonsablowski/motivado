/**
 * Body-measure calculators behind the legacy `DieterCategory` and
 * `EnergyDemand` widgets. The Flash originals are lost, so these use standard
 * formulas; the assumptions are marked where they matter.
 */

export type Sex = 'f' | 'm';

/** Parse a number the way users type it in German ("72,5"). */
export function parseNumber(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
  if (typeof input !== 'string') return undefined;
  const n = Number(input.trim().replace(',', '.'));
  return input.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

/** Normalise the values the models use for gender ('f', 'm', 'Frau', 'Herr', 'weiblich', ...). */
export function parseSex(input: unknown): Sex | undefined {
  if (typeof input !== 'string') return undefined;
  const s = input.trim().toLowerCase();
  if (/^(f|w|frau|weiblich)/.test(s)) return 'f';
  if (/^(m|herr|männlich|maennlich)/.test(s)) return 'm';
  return undefined;
}

/** Body mass index. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiBand = 'A' | 'B' | 'C' | 'D';

/**
 * Band of the BMI: A below 25, B 25 to below 30, C 30 to below 35, D from 35
 * (WHO classes: normal or under, pre-obese, obese I, obese II and III).
 */
export function bmiBand(value: number): BmiBand {
  if (value < 25) return 'A';
  if (value < 30) return 'B';
  if (value < 35) return 'C';
  return 'D';
}

export const BMI_LABELS: Record<BmiBand, string> = {
  A: 'Normal- bis Untergewicht',
  B: 'Übergewicht',
  C: 'Adipositas Grad I',
  D: 'Adipositas Grad II und höher',
};

/**
 * Category used by the "Abnehmchancen" check: band + 1 (women) / 2 (men).
 * The legacy meaning of the suffix 1/2 is not documented; the owner decided to
 * use female / male, the only split that fits the inputs the widget had.
 */
export function dieterCategory(weightKg: number, heightCm: number, sex: Sex): string {
  return `${bmiBand(bmi(weightKg, heightCm))}${sex === 'f' ? 1 : 2}`;
}

export const ACTIVITY_LEVELS = [
  { value: '1.2', label: 'Überwiegend sitzend, kaum Sport' },
  { value: '1.4', label: 'Überwiegend sitzend, gelegentlich Sport' },
  { value: '1.6', label: 'Viel in Bewegung oder regelmäßig Sport' },
  { value: '1.8', label: 'Körperlich anstrengende Arbeit oder täglich Sport' },
] as const;

export interface EnergyInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  /** Physical activity level factor, e.g. 1.4. */
  activity: number;
  /** Planned loss in grams per week, optional. */
  lossGramsPerWeek?: number;
}

export interface EnergyResult {
  /** Basal metabolic rate in kcal/day (Mifflin-St Jeor). */
  basal: number;
  /** Total energy demand in kcal/day. */
  total: number;
  /** Daily target when losing weight, never below the basal rate. */
  target?: number;
}

const KCAL_PER_KG_FAT = 7000;

export function energyDemand(i: EnergyInput): EnergyResult {
  const basal = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === 'm' ? 5 : -161);
  const total = basal * i.activity;
  const result: EnergyResult = { basal: Math.round(basal), total: Math.round(total) };
  if (i.lossGramsPerWeek && i.lossGramsPerWeek > 0) {
    const deficit = (i.lossGramsPerWeek / 1000) * (KCAL_PER_KG_FAT / 7);
    result.target = Math.round(Math.max(basal, total - deficit));
  }
  return result;
}
