import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -profilePhoto').lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    // Block check — prevent blocked users from accessing anything
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account has been suspended. Contact support.', code: 'ACCOUNT_BLOCKED' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
