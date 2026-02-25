import User from '../models/User.js';

// Re-verify admin role from DB on every request (prevents role tampering via old JWT)
export const admin = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    // Re-check from database to prevent stale JWT role abuse
    const freshUser = await User.findById(req.user._id).select('role').lean();
    if (!freshUser || freshUser.role !== 'admin') {
      console.error(`[SECURITY] Non-admin attempted admin access: userId=${req.user._id} jwtRole=${req.user.role} dbRole=${freshUser?.role}`);
      return res.status(403).json({ success: false, message: 'Admin access revoked' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
