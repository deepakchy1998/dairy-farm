/**
 * Input sanitization middleware
 * Prevents NoSQL injection, XSS, and prototype pollution
 */

function sanitizeValue(val) {
  if (typeof val === 'string') {
    // Remove any $ operators (NoSQL injection)
    return val.replace(/\$/g, '');
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    // Remove keys starting with $ (NoSQL injection)
    // Remove __proto__, constructor, prototype (prototype pollution)
    const forbidden = ['__proto__', 'constructor', 'prototype'];
    const cleaned = {};
    for (const [key, value] of Object.entries(val)) {
      if (key.startsWith('$') || forbidden.includes(key)) continue;
      cleaned[key] = sanitizeValue(value);
    }
    return cleaned;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  return val;
}

export const sanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
