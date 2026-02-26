import { z } from 'zod';

const yieldField = z.number().min(0).max(100, 'Yield must be 0-100L').optional().nullable();
const fatField = z.number().min(0).max(15, 'Fat must be 0-15%').optional().nullable();
const snfField = z.number().min(0).max(20).optional().nullable();

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
  quantity: z.number().positive('Quantity is required'),
  fat: z.number().min(0).max(15, 'Fat must be 0-15%'),
  snf: z.number().min(0).max(20).optional(),
  ratePerFat: z.number().min(0).optional().default(7.5),
  baseRate: z.number().min(0).optional().default(0),
});
