import { describe, it, expect, vi } from 'vitest';
import { sanitize } from '../middleware/sanitize.js';

function mockReq(body = {}, query = {}, params = {}) {
  return { body, query, params };
}

describe('sanitize middleware', () => {
  it('removes $ operators from strings', () => {
    const req = mockReq({ email: { $gt: '' } });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.body.email).not.toHaveProperty('$gt');
    expect(next).toHaveBeenCalled();
  });

  it('removes __proto__ keys', () => {
    const req = mockReq({ __proto__: 'bad', name: 'ok' });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.body).not.toHaveProperty('__proto__');
    expect(next).toHaveBeenCalled();
  });

  it('strips $ from string values', () => {
    const req = mockReq({ search: '$regex attack' });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.body.search).toBe('regex attack');
    expect(next).toHaveBeenCalled();
  });

  it('handles nested objects', () => {
    const req = mockReq({ user: { $ne: null } });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.body.user).not.toHaveProperty('$ne');
    expect(next).toHaveBeenCalled();
  });

  it('sanitizes query params too', () => {
    const req = mockReq({}, { id: { $gt: '' } });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.query.id).not.toHaveProperty('$gt');
  });

  it('passes through clean data unchanged', () => {
    const req = mockReq({ name: 'John', age: 25 });
    const next = vi.fn();
    sanitize(req, {}, next);
    expect(req.body).toEqual({ name: 'John', age: 25 });
    expect(next).toHaveBeenCalled();
  });
});
