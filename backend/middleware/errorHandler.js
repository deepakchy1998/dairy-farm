export const errorHandler = (err, req, res, next) => {
  // Log full error with request context for debugging
  console.error(`[${req.id || '-'}] ${req.method} ${req.originalUrl} Error:`, err.stack || err.message);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  
  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(400).json({ success: false, message: `Duplicate value for ${field}` });
  }
  
  // Invalid ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Don't leak internal error messages in production
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && isProduction 
    ? 'An unexpected error occurred. Please try again.' 
    : err.message || 'Server error';

  res.status(statusCode).json({ success: false, message });
};
