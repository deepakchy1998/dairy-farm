import { z } from 'zod';

export const createCattleSchema = z.object({
  tagNumber: z.string().min(1, 'Tag number is required').max(50).trim(),
  breed: z.string().max(100).optional().default(''),
  gender: z.enum(['female', 'male']).optional().default('female'),
  category: z.enum(['milking', 'dry', 'heifer', 'calf', 'bull']).optional().default('milking'),
  dateOfBirth: z.string().optional(),
  weight: z.coerce.number().min(0).max(2000).optional().or(z.literal('')),
  purchaseDate: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional().or(z.literal('')),
  status: z.enum(['active', 'sold', 'deceased', 'transferred']).optional().default('active'),
  notes: z.string().max(2000).optional(),
}).passthrough(); // allow additional model fields

export const updateCattleSchema = createCattleSchema.partial().passthrough();

export const addWeightSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  weight: z.coerce.number().min(0.1, 'Weight must be positive').max(2000, 'Weight must be under 2000 kg'),
  notes: z.string().max(500).optional(),
});

export const cattleQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  gender: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
}).passthrough();
