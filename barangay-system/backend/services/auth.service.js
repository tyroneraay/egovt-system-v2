const { supabase, supabaseAdmin } = require('../config/supabase');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../utils/errors');
const auditService = require('./audit.service');
const notifService = require('./notification.service');

/**
 * Register a new resident account.
 */
const register = async ({ email, password, firstName, middleName, lastName, suffix, phone, address, civilStatus, dateOfBirth, validIdUrl }) => {
  // Create auth user
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm for now
  });

  if (authErr) {
    if (authErr.message.includes('already registered')) {
      throw new BadRequestError('Email already registered');
    }
    throw authErr;
  }

  const userId = authData.user.id;

  // Create user record
  const { error: userErr } = await supabaseAdmin.from('users').insert({
    id: userId,
    email,
    role: 'resident',
    is_verified: false,
  });

  if (userErr) throw userErr;

  // Create resident profile
  const { error: profileErr } = await supabaseAdmin.from('resident_profiles').insert({
    user_id: userId,
    first_name: firstName,
    middle_name: middleName || null,
    last_name: lastName,
    suffix: suffix || null,
    phone: phone || null,
    address: address || null,
    civil_status: civilStatus || null,
    date_of_birth: dateOfBirth || null,
    valid_id_url: validIdUrl || null,
    verification_status: 'pending',
  });

  if (profileErr) throw profileErr;

  // Audit
  await auditService.createLog({
    actorId: userId,
    actorName: `${firstName} ${lastName}`,
    action: 'account.registered',
    targetTable: 'users',
    targetId: userId,
    detail: `New resident: ${firstName} ${lastName} (${email})`,
  });

  // Notify staff
  const staffIds = await notifService.getStaffAndAdminIds();
  await notifService.notifyMany(staffIds, {
    title: 'New Registration',
    message: `${firstName} ${lastName} registered. Awaiting verification.`,
    type: 'new_registration',
    referenceId: userId,
  });

  return { userId, email };
};

/**
 * Login — delegates to Supabase Auth.
 */
const login = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new UnauthorizedError('Invalid email or password');

  // Get user role
  const { data: dbUser, error: dbErr } = await supabaseAdmin
    .from('users')
    .select('id, email, role, is_verified')
    .eq('id', data.user.id)
    .single();

  if (dbErr || !dbUser) throw new UnauthorizedError('User not found in system');

  // Get profile based on role
  let profile = null;
  if (dbUser.role === 'resident') {
    const { data: rp } = await supabaseAdmin
      .from('resident_profiles')
      .select('*')
      .eq('user_id', dbUser.id)
      .single();
    profile = rp;
  } else if (dbUser.role === 'staff') {
    const { data: sp } = await supabaseAdmin
      .from('staff_profiles')
      .select('*')
      .eq('user_id', dbUser.id)
      .single();
    profile = sp;
  }

  return {
    session: data.session,
    user: {
      ...dbUser,
      profile,
    },
  };
};

/**
 * Get current user profile.
 */
const getProfile = async (userId, role) => {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, role, is_verified, created_at')
    .eq('id', userId)
    .single();

  let profile = null;
  if (role === 'resident') {
    const { data } = await supabaseAdmin
      .from('resident_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    profile = data;
  } else if (role === 'staff') {
    const { data } = await supabaseAdmin
      .from('staff_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    profile = data;
  }

  return { ...user, profile };
};

/**
 * Change password.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  // Get user email
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (!user) throw new NotFoundError('User not found');

  // Verify current password by attempting login
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (loginErr) throw new BadRequestError('Current password is incorrect');

  // Update password
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateErr) throw updateErr;

  await auditService.createLog({
    actorId: userId,
    actorName: user.email,
    action: 'account.password_changed',
    targetTable: 'users',
    targetId: userId,
  });
};

/**
 * Update resident profile (editable fields only).
 */
const updateResidentProfile = async (userId, updates) => {
  const allowedFields = ['phone', 'address', 'civil_status'];
  const filtered = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    throw new BadRequestError('No valid fields to update');
  }

  const { data, error } = await supabaseAdmin
    .from('resident_profiles')
    .update(filtered)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;

  // Update email if provided
  if (updates.email) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email: updates.email });
    await supabaseAdmin.from('users').update({ email: updates.email }).eq('id', userId);
  }

  return data;
};

/**
 * Update admin profile.
 */
const updateAdminProfile = async (userId, updates) => {
  if (updates.email) {
    await supabaseAdmin.auth.admin.updateUserById(userId, { email: updates.email });
    await supabaseAdmin.from('users').update({ email: updates.email }).eq('id', userId);
  }

  // Admin doesn't have a separate profile table — name changes could be handled
  // via a display_name field on users table if needed

  return { updated: true };
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
  updateResidentProfile,
  updateAdminProfile,
};
