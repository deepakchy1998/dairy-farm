import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { createServer } from 'http';

import authRoutes from './routes/auth.js';
import farmRoutes from './routes/farm.js';
import cattleRoutes from './routes/cattle.js';
import milkRoutes from './routes/milk.js';
import healthRoutes from './routes/health.js';
import breedingRoutes from './routes/breeding.js';
import feedRoutes from './routes/feed.js';
import expenseRoutes from './routes/expense.js';
import revenueRoutes from './routes/revenue.js';
import reportRoutes from './routes/reports.js';
import activityRoutes from './routes/activity.js';
import subscriptionRoutes from './routes/subscription.js';
import paymentRoutes from './routes/payment.js';
import razorpayRoutes from './routes/razorpay.js';
import adminRoutes from './routes/admin.js';
import appConfigRoutes from './routes/appConfig.js';
import landingRoutes from './routes/landing.js';
import chatbotRoutes from './routes/chatbot.js';
import notificationRoutes from './routes/notifications.js';
import insuranceRoutes from './routes/insurance.js';
import milkDeliveryRoutes from './routes/milkDelivery.js';
import employeeRoutes from './routes/employee.js';
import contactRoutes from './routes/contact.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitize } from './middleware/sanitize.js';
import { ensureIndexes } from './utils/ensureIndexes.js';

const app = express();

// Enable trust proxy for proper IP detection behind Render's proxy
app.set('trust proxy', 1);

// ─── Request ID for tracing & debugging ───
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Keep-alive for better performance
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=65');
  next();
});

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400, // 24 hour preflight cache
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.onrender.com https://*.vercel.app");
  next();
});

// Cache control for performance
app.use((req, res, next) => {
  if (req.path.includes('/landing') || req.path.includes('/plans')) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  } else if (req.headers.authorization) {
    res.setHeader('Cache-Control', 'private, no-cache');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(sanitize);

// Request timeout (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timeout' });
    }
  });
  next();
});

// ─── Rate limiter with automatic cleanup ───
const authAttempts = new Map();
const AUTH_LIMIT = 10; // max attempts
const AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of authAttempts) {
    const recent = attempts.filter(t => now - t < AUTH_WINDOW);
    if (recent.length === 0) {
      authAttempts.delete(key);
    } else {
      authAttempts.set(key, recent);
    }
  }
}, 5 * 60 * 1000);

const authRateLimit = (req, res, next) => {
  const key = req.ip + ':' + (req.body?.email || '');
  const now = Date.now();
  const attempts = authAttempts.get(key) || [];
  const recent = attempts.filter(t => now - t < AUTH_WINDOW);
  if (recent.length >= AUTH_LIMIT) {
    return res.status(429).json({ success: false, message: 'Too many attempts. Please try again in 15 minutes.' });
  }
  recent.push(now);
  authAttempts.set(key, recent);
  next();
};

// ─── Global rate limiter (per IP, 100 req/min) ───
const globalRequests = new Map();
const GLOBAL_LIMIT = 100;
const GLOBAL_WINDOW = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of globalRequests) {
    if (now - data.start > GLOBAL_WINDOW) globalRequests.delete(key);
  }
}, 60 * 1000);

app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  let entry = globalRequests.get(ip);
  if (!entry || now - entry.start > GLOBAL_WINDOW) {
    entry = { count: 0, start: now };
  }
  entry.count++;
  globalRequests.set(ip, entry);
  if (entry.count > GLOBAL_LIMIT) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
  }
  next();
});

// ─── Forgot password rate limiter (3 req / 15 min per IP) ───
const forgotAttempts = new Map();
const forgotRateLimit = (req, res, next) => {
  if (!req.path.includes('forgot-password')) return next();
  const key = req.ip;
  const now = Date.now();
  const attempts = (forgotAttempts.get(key) || []).filter(t => now - t < 15 * 60 * 1000);
  if (attempts.length >= 3) {
    return res.status(429).json({ success: false, message: 'Too many password reset requests. Try again later.' });
  }
  attempts.push(now);
  forgotAttempts.set(key, attempts);
  next();
};

// Public routes
app.use('/api/auth', forgotRateLimit, authRateLimit, authRoutes);
app.use('/api/landing', landingRoutes);

// Protected routes
app.use('/api/farm', farmRoutes);
app.use('/api/cattle', cattleRoutes);
app.use('/api/milk', milkRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/breeding', breedingRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/expense', expenseRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/subscription', subscriptionRoutes);
// Razorpay webhook needs raw body for signature verification (no rate limit for webhooks)
app.use('/api/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayRoutes);
// Rate limit payment creation: max 10 per 15 min per IP
const paymentRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Too many payment attempts. Please try again later.' } });
app.use('/api/razorpay', paymentRateLimit, express.json(), razorpayRoutes);
// Legacy payment route (read-only for history)
app.use('/api/payment', express.json({ limit: '10mb' }), paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/app-config', appConfigRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/milk-delivery', milkDeliveryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/health-check', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  res.json({
    success: true,
    message: 'DairyPro API is running',
    version: '1.1.0',
    database: dbStatus,
    uptime: Math.floor(process.uptime()),
  });
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ─── Graceful shutdown ───
let server;

async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      mongoose.connection.close(false).then(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    });
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Uncaught error handlers ───
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message, err.stack);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// ─── MongoDB connection with retry ───
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function connectWithRetry(retries = 0) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production',
    });
    console.log('✅ MongoDB connected');
    await ensureIndexes();
    server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (err) {
    console.error(`❌ MongoDB connection error (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, err.message);
    if (retries < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${RETRY_DELAY / 1000}s...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
      return connectWithRetry(retries + 1);
    }
    console.error('❌ All connection attempts failed. Exiting.');
    process.exit(1);
  }
}

// Monitor MongoDB connection events
mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

connectWithRetry();
