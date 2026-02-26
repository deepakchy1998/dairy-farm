import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth.js';
import { createCattleSchema, addWeightSchema } from '../validators/cattle.js';
import { createMilkRecordSchema, calculateRateSchema } from '../validators/milk.js';

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    it('accepts valid registration', () => {
      const result = registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('john@example.com');
    });

    it('rejects missing name', () => {
      const result = registerSchema.safeParse({ email: 'a@b.com', password: '123456' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'notanemail', password: '123456' });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'a@b.com', password: '123' });
      expect(result.success).toBe(false);
    });

    it('lowercases email', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'JOHN@Example.COM', password: '123456' });
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('john@example.com');
    });

    it('trims name', () => {
      const result = registerSchema.safeParse({ name: '  John  ', email: 'a@b.com', password: '123456' });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
    });

    it('rejects name over 100 chars', () => {
      const result = registerSchema.safeParse({ name: 'x'.repeat(101), email: 'a@b.com', password: '123456' });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com', password: 'pass123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com', password: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('accepts valid change', () => {
      const result = changePasswordSchema.safeParse({ currentPassword: 'old123', newPassword: 'new123' });
      expect(result.success).toBe(true);
    });

    it('rejects short new password', () => {
      const result = changePasswordSchema.safeParse({ currentPassword: 'old123', newPassword: '12' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Cattle Validators', () => {
  describe('createCattleSchema', () => {
    it('accepts valid cattle', () => {
      const result = createCattleSchema.safeParse({ tagNumber: 'C001', breed: 'Holstein' });
      expect(result.success).toBe(true);
    });

    it('rejects empty tag number', () => {
      const result = createCattleSchema.safeParse({ tagNumber: '' });
      expect(result.success).toBe(false);
    });

    it('validates gender enum', () => {
      const result = createCattleSchema.safeParse({ tagNumber: 'C001', gender: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('validates category enum', () => {
      const result = createCattleSchema.safeParse({ tagNumber: 'C001', category: 'milking' });
      expect(result.success).toBe(true);
    });
  });

  describe('addWeightSchema', () => {
    it('accepts valid weight', () => {
      const result = addWeightSchema.safeParse({ date: '2024-01-15', weight: 450 });
      expect(result.success).toBe(true);
    });

    it('rejects weight over 2000', () => {
      const result = addWeightSchema.safeParse({ date: '2024-01-15', weight: 2500 });
      expect(result.success).toBe(false);
    });

    it('rejects zero weight', () => {
      const result = addWeightSchema.safeParse({ date: '2024-01-15', weight: 0 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Milk Validators', () => {
  describe('createMilkRecordSchema', () => {
    it('accepts valid milk record', () => {
      const result = createMilkRecordSchema.safeParse({
        cattleId: '507f1f77bcf86cd799439011',
        date: '2024-01-15',
        morningYield: 12.5,
        morningFat: 4.2,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing cattleId', () => {
      const result = createMilkRecordSchema.safeParse({ date: '2024-01-15' });
      expect(result.success).toBe(false);
    });

    it('rejects yield over 100', () => {
      const result = createMilkRecordSchema.safeParse({
        cattleId: 'abc', date: '2024-01-15', morningYield: 150,
      });
      expect(result.success).toBe(false);
    });

    it('rejects fat over 15', () => {
      const result = createMilkRecordSchema.safeParse({
        cattleId: 'abc', date: '2024-01-15', morningFat: 20,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('calculateRateSchema', () => {
    it('accepts valid rate calculation', () => {
      const result = calculateRateSchema.safeParse({ quantity: 10, fat: 4.5 });
      expect(result.success).toBe(true);
      expect(result.data.ratePerFat).toBe(7.5); // default
    });

    it('rejects negative quantity', () => {
      const result = calculateRateSchema.safeParse({ quantity: -5, fat: 4.5 });
      expect(result.success).toBe(false);
    });
  });
});
