const { supabaseAdmin } = require('../config/supabase');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const auditService = require('./audit.service');

/**
 * List all staff.
 */
const getAllStaff = async () => {
  const { data, error } = await supabaseAdmin
    .from('staff_profiles')
    .select('*, users(id, email, role, created_at)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Create a new staff account (admin only).
 */
const createStaff = async ({ email, password, firstName, lastName, position, adminId, adminName, ipAddress }) => {
  // Create auth user
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
    role: 'staff',
    is_verified: true,
  });

  if (userErr) throw userErr;

  // Create staff profile
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('staff_profiles')
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      position: position || 'Staff',
      is_active: true,
    })
    .select('*')
    .single();

  if (profileErr) throw profileErr;

  await auditService.createLog({
    actorId: adminId,
    actorName: adminName,
    action: 'staff.created',
    targetTable: 'staff_profiles',
    targetId: profile.id,
    detail: `Created staff: ${firstName} ${lastName} (${email})`,
    ipAddress,
  });

  return { userId, email, profile };
};

/**
 * Update staff (activate/deactivate, change position).
 */
const updateStaff = async ({ staffUserId, updates, adminId, adminName, ipAddress }) => {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('staff_profiles')
    .select('*')
    .eq('user_id', staffUserId)
    .single();

  if (fetchErr || !profile) throw new NotFoundError('Staff not found');

  const updateData = {};
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.position !== undefined) updateData.position = updates.position;

  const { data, error } = await supabaseAdmin
    .from('staff_profiles')
    .update(updateData)
    .eq('user_id', staffUserId)
    .select('*')
    .single();

  if (error) throw error;

  const staffName = `${profile.first_name} ${profile.last_name}`;
  const action = updates.is_active === false ? 'staff.deactivated' : updates.is_active === true ? 'staff.activated' : 'staff.updated';

  await auditService.createLog({
    actorId: adminId,
    actorName: adminName,
    action,
    targetTable: 'staff_profiles',
    targetId: profile.id,
    detail: `${staffName}: ${JSON.stringify(updates)}`,
    ipAddress,
  });

  return data;
};

/**
 * Permanently delete a staff account (admin only).
 */
const deleteStaff = async ({ staffUserId, adminId, adminName, ipAddress }) => {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('staff_profiles')
    .select('*')
    .eq('user_id', staffUserId)
    .single();

  if (fetchErr || !profile) throw new NotFoundError('Staff not found');

  const staffName = `${profile.first_name} ${profile.last_name}`;

  // Delete from auth — this cascades through users → staff_profiles via FK ON DELETE CASCADE
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(staffUserId);
  if (authErr) throw authErr;

  await auditService.createLog({
    actorId: adminId,
    actorName: adminName,
    action: 'staff.deleted',
    targetTable: 'staff_profiles',
    targetId: profile.id,
    detail: `Deleted staff: ${staffName}`,
    ipAddress,
  });

  return { success: true };
};

module.exports = { getAllStaff, createStaff, updateStaff, deleteStaff };
