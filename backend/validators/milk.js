import { z } from 'zod';

// Empty strings and null should become null (not recorded), valid numbers should be coerced
const numericOrNull = (min, max, msg) => z.preprocess(
  (val) => (val === '' || val === null || val === undefined) ? null : Number(val),
  z.number().min(min).max(max, msg).nullable().optional()
);
const yieldField = numericOrNull(0, 100, 'Yield must be 0-100L');
const fatField = numericOrNull(0, 15, 'Fat must be 0-15%');
const snfField = numericOrNull(0, 20, 'SNF must be 0-20%');

export const createMilkRecordSchema = z.object({
  cattleId: z.string().min(1, 'Cattle is required'),
  date: z.string().min(1, 'Date is required'),
  morningYield: yieldField,
  morningFat: fatField,
  morningSNF: snfField,
  afternoonYield: yieldField,
  afternoonFat: fatField,
  afternoonSNF: snfField,
  eveningYield: yieldField,
  eveningFat: fatField,
  eveningSNF: snfField,
}).passthrough();

export const updateMilkRecordSchema = createMilkRecordSchema.partial().passthrough();

export const calculateRateSchema = z.object({
  quantity: z.coerce.number().positive('Quantity is required'),
  fat: z.coerce.number().min(0).max(15, 'Fat must be 0-15%'),
  snf: z.coerce.number().min(0).max(20).optional(),
  ratePerFat: z.coerce.number().min(0).optional().default(7.5),
  baseRate: z.coerce.number().min(0).optional().default(0),
});
