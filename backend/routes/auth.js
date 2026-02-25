import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Farm from '../models/Farm.js';
import Subscription from '../models/Subscription.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const signToken = (user) => jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, farmName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    // Password strength check
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    if (name.length > 100 || email.length > 255) {
      return res.status(400).json({ success: false, message: 'Input too long' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    // Anti-trial-abuse: limit registrations per IP (max 3 accounts per IP per week)
    const recentFromIP = await User.countDocuments({
      registrationIP: req.ip,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    if (recentFromIP >= 3) {
      return res.status(429).json({ success: false, message: 'Too many accounts created. Please try again later or contact support.' });
    }

    const user = await User.create({ name, email, password, phone, registrationIP: req.ip });
    const farm = await Farm.create({ name: farmName || `${name}'s Farm`, owner: user._id });
    user.farmId = farm._id;
    await user.save();

    // 5-day free trial
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    await Subscription.create({ userId: user._id, plan: 'trial', startDate: now, endDate: trialEnd });

    const token = signToken(user);
    const userData = { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, farmId: user.farmId, profilePhoto: user.profilePhoto || "", createdAt: user.createdAt };
    res.status(201).json({ success: true, data: { token, user: userData } });
  } catch (err) { next(err); }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });

    // Check account lockout
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ success: false, message: `Account temporarily locked. Try again in ${minutesLeft} minutes.` });
    }

    if (!user || !(await user.comparePassword(password))) {
      // Increment failed attempts
      if (user) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lockout
          user.loginAttempts = 0;
        }
        await user.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact support.' });
    }

    // Reset login attempts on success
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);
    const userData = { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, farmId: user.farmId, profilePhoto: user.profilePhoto || "", createdAt: user.createdAt };
    res.json({ success: true, data: { token, user: userData } });
  } catch (err) { next(err); }
});

// Forgot password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });
    if (!user) return res.json({ success: true, message: 'If an account exists with that email, a password reset link will be sent.' });
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    res.json({ success: true, message: 'If an account exists with that email, a password reset link will be sent.' });
  } catch (err) { next(err); }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password required' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) { next(err); }
});

// Get me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await (await import('../models/User.js')).default.findById(req.user._id).select('-password').lean();
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// Update profile
router.put('/profile', auth, async (req, res, next) => {
  try {
    const { name, email, phone, profilePhoto } = req.body;
    const user = await User.findById(req.user._id);
    if (email && email !== user.email) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
      if (exists) return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (profilePhoto !== undefined) {
      // Validate: must be a data URI or empty string to remove
      if (profilePhoto && !profilePhoto.startsWith('data:image/')) {
        return res.status(400).json({ success: false, message: 'Invalid image format' });
      }
      // Limit size ~2MB in base64
      if (profilePhoto && profilePhoto.length > 2 * 1024 * 1024 * 1.37) {
        return res.status(400).json({ success: false, message: 'Profile photo must be under 2MB' });
      }
      user.profilePhoto = profilePhoto;
    }
    await user.save();
    const userData = { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, farmId: user.farmId, profilePhoto: user.profilePhoto, createdAt: user.createdAt };
    res.json({ success: true, data: userData });
  } catch (err) { next(err); }
});

// Change password
router.put('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
});

export default router;
