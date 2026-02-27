// ─── User-Friendly Error Messages ───
const friendlyMessages = {
  // Auth & Access
  'No token provided': '🔑 Please login to continue. Your session may have expired.',
  'Invalid token': '🔑 Your session has expired. Please login again.',
  'Token expired': '⏰ Your session has expired. Please login again to continue.',
  'User not found': '👤 Account not found. Please login again or contact support.',
  'Admin access required': '🔒 This section is for administrators only.',
  'Admin access revoked': '🔒 Your admin access has been revoked. Contact the administrator.',

  // Subscription
  'SUBSCRIPTION_EXPIRED': '📋 Your subscription has expired. Please renew to continue using all features.',
  'SUBSCRIPTION_INVALID': '⚠️ There was an issue with your subscription. Please contact support for help.',

  // Account
  'ACCOUNT_BLOCKED': '🚫 Your account has been temporarily suspended. Please contact support for assistance.',
  'Invalid credentials': '❌ Incorrect email or password. Please check and try again.',
  'Email already registered': '📧 This email is already registered. Try logging in or use a different email.',
  'Phone already registered': '📱 This phone number is already in use. Try a different number.',
};

// Field-specific duplicate key messages
const duplicateFieldMessages = {
  email: '📧 This email address is already registered.',
  phone: '📱 This phone number is already in use.',
  tagNumber: '🐄 This tag number already exists in your farm. Use a unique tag.',
  policyNumber: '🛡️ This policy number already exists.',
  name: '📝 This name already exists. Please use a different name.',
};

export const errorHandler = (err, req, res, next) => {
  // Log full error with request context for debugging
  console.error(`[${req.id || '-'}] ${req.method} ${req.originalUrl} Error:`, err.stack || err.message);

  // Mongoose validation error → friendly field-level messages
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => {
      if (e.kind === 'required') return `📝 ${e.path} is required. Please fill in this field.`;
      if (e.kind === 'enum') return `📝 Invalid value for ${e.path}. Please select a valid option.`;
      if (e.kind === 'min') return `📝 ${e.path} is too small. Minimum value is ${e.properties?.min}.`;
      if (e.kind === 'max') return `📝 ${e.path} is too large. Maximum value is ${e.properties?.max}.`;
      if (e.kind === 'minlength') return `📝 ${e.path} is too short. Minimum ${e.properties?.minlength} characters.`;
      if (e.kind === 'maxlength') return `📝 ${e.path} is too long. Maximum ${e.properties?.maxlength} characters.`;
      return `📝 ${e.message}`;
    });
    return res.status(400).json({ success: false, message: messages.join('\n'), code: 'VALIDATION_ERROR' });
  }
  
  // Duplicate key → specific field messages
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const message = duplicateFieldMessages[field] || `📝 A record with this ${field} already exists. Please use a different value.`;
    return res.status(400).json({ success: false, message, code: 'DUPLICATE_ERROR' });
  }
  
  // Invalid ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: '⚠️ Invalid data format. Please refresh the page and try again.', code: 'INVALID_ID' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: '🔑 Your session is invalid. Please login again.', code: 'INVALID_TOKEN' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: '⏰ Your session has expired. Please login again to continue.', code: 'TOKEN_EXPIRED' });
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    return res.status(503).json({ success: false, message: '🔄 Server is temporarily busy. Please try again in a few seconds.', code: 'DB_ERROR' });
  }

  // File/upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: '📁 File is too large. Please upload a smaller file (max 5MB).', code: 'FILE_TOO_LARGE' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: '📁 Unexpected file type. Please upload a valid image file.', code: 'INVALID_FILE' });
  }

  // Network/timeout errors
  if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
    return res.status(504).json({ success: false, message: '⏰ Request took too long. Please check your connection and try again.', code: 'TIMEOUT' });
  }

  // Check for known friendly messages
  const friendly = friendlyMessages[err.message] || friendlyMessages[err.code];
  if (friendly) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({ success: false, message: friendly, code: err.code });
  }

  // Default: user-friendly message (hide technical details)
  const statusCode = err.statusCode || 500;
  const userMessage = statusCode === 500
    ? '😔 Something went wrong on our end. Please try again. If the problem persists, contact support.'
    : err.message || '⚠️ Something unexpected happened. Please try again.';

  res.status(statusCode).json({ success: false, message: userMessage, code: 'SERVER_ERROR' });
};
