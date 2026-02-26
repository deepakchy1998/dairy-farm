/**
 * Zod validation middleware factory
 * Usage: router.post('/', validate(schema), handler)
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const errors = result.error.issues.map(i => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return res.status(400).json({
      success: false,
      message: errors[0]?.message || 'Validation failed',
      errors,
    });
  }
  req[source] = result.data; // use parsed & cleaned data
  next();
};

export const validateQuery = (schema) => validate(schema, 'query');
