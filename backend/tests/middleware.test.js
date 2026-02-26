import { describe, it, expect, vi } from 'vitest';
import { validate, validateQuery } from '../middleware/validate.js';
import { z } from 'zod';

function mockReqRes(body = {}, query = {}) {
  const req = { body, query, params: {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().min(0),
  });

  it('passes valid data and calls next', () => {
    const { req, res, next } = mockReqRes({ name: 'John', age: 25 });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body.name).toBe('John');
  });

  it('rejects invalid data with 400', () => {
    const { req, res, next } = mockReqRes({ name: '', age: -1 });
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns field-level error details', () => {
    const { req, res, next } = mockReqRes({ age: 25 });
    validate(schema)(req, res, next);
    expect(res.body.errors[0].field).toBe('name');
  });
});

describe('validateQuery middleware', () => {
  const schema = z.object({
    page: z.string().regex(/^\d+$/).optional(),
  });

  it('validates query params', () => {
    const { req, res, next } = mockReqRes({}, { page: '5' });
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects invalid query', () => {
    const { req, res, next } = mockReqRes({}, { page: 'abc' });
    validateQuery(schema)(req, res, next);
    expect(res.statusCode).toBe(400);
  });
});
