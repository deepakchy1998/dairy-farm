import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '🔑 Please login to continue. Your session may have expired.', code: 'NO_TOKEN' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -profilePhoto').lean();
    if (!user) return res.status(401).json({ success: false, message: '👤 Account not found. Please login again.', code: 'USER_NOT_FOUND' });
    // Block check — prevent blocked users from accessing anything
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: '🚫 Your account has been temporarily suspended. Please contact support for assistance.', code: 'ACCOUNT_BLOCKED' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '⏰ Your session has expired. Please login again.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: '🔑 Your session is invalid. Please login again.', code: 'INVALID_TOKEN' });
  }
};
