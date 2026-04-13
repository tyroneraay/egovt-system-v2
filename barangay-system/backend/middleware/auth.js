const { supabase } = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Auth middleware — verifies Supabase JWT from Authorization header.
 * Attaches user object to req.user with { id, email, role }.
 * Also creates a per-request Supabase client scoped to the user's session.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    } else {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    // Verify token with Supabase
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);

    if (error || !authUser) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Fetch user record from our users table
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_verified')
      .eq('id', authUser.id)
      .single();

    if (dbError || !dbUser) {
      throw new UnauthorizedError('User not found in system');
    }

    // Attach to request
    req.user = dbUser;
    req.token = token;

    // Create user-scoped Supabase client for RLS queries
    const { createClient } = require('@supabase/supabase-js');
    req.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    );

    next();
  } catch (err) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };
