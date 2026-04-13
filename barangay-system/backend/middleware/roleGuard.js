const { ForbiddenError } = require('../utils/errors');

/**
 * Role-based access control middleware.
 * Usage: roleGuard('admin', 'staff') — allows admin and staff only.
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};

/**
 * Verified account guard — ensures resident is verified before proceeding.
 */
const verifiedGuard = async (req, res, next) => {
  if (req.user.role === 'resident' && !req.user.is_verified) {
    return res.status(403).json({
      error: 'Account not yet verified. Please wait for staff approval.',
    });
  }
  next();
};

module.exports = { roleGuard, verifiedGuard };
