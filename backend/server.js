import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';

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
import adminRoutes from './routes/admin.js';
import landingRoutes from './routes/landing.js';
import chatbotRoutes from './routes/chatbot.js';
import notificationRoutes from './routes/notifications.js';
import insuranceRoutes from './routes/insurance.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureIndexes } from './utils/ensureIndexes.js';

const app = express();

app.use(helmet());
app.use(cors());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '10mb' }));

// Simple rate limiter for auth routes
const authAttempts = new Map();
const AUTH_LIMIT = 10; // max attempts
const AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes

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
  // Cleanup old entries periodically
  if (authAttempts.size > 10000) {
    for (const [k, v] of authAttempts) {
      if (v.every(t => now - t > AUTH_WINDOW)) authAttempts.delete(k);
    }
  }
  next();
};

// Public routes
app.use('/api/auth', authRateLimit, authRoutes);
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
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/insurance', insuranceRoutes);

app.get('/api/health-check', (req, res) => res.json({ success: true, message: 'DairyPro API is running' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await ensureIndexes();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
