const { supabaseAdmin } = require('../config/supabase');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const auditService = require('./audit.service');
const notifService = require('./notification.service');
const emailService = require('./email.service');

/**
 * IMPORTANT: resident_profiles has TWO foreign keys to users table:
 *   - user_id    → users(id)   (the resident's account)
 *   - verified_by → users(id)  (the staff who verified)
 *
 * This causes PostgREST error: "more than one relationship was found"
 * FIX: Use !resident_profiles_user_id_fkey hint to disambiguate.
 */

const USER_JOIN = 'users!resident_profiles_user_id_fkey';

/**
 * Get pending verifications with full profile data including valid_id_url.
 */
const getPending = async () => {
  const { data, error } = await supabaseAdmin
    .from('resident_profiles')
    .select(`
      id, user_id, first_name, middle_name, last_name, suffix,
      phone, address, civil_status, date_of_birth,
      valid_id_url, verification_status, rejection_reason,
      created_at,
      ${USER_JOIN}(id, email)
    `)
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
};

/**
 * Get all verified residents.
 */
const getVerified = async () => {
  const { data, error } = await supabaseAdmin
    .from('resident_profiles')
    .select(`
      id, user_id, first_name, last_name,
      verified_at,
      ${USER_JOIN}(id, email)
    `)
    .eq('verification_status', 'verified')
    .order('verified_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Get rejected residents (can re-upload ID).
 */
const getRejected = async () => {
  const { data, error } = await supabaseAdmin
    .from('resident_profiles')
    .select(`
      id, user_id, first_name, last_name,
      rejection_reason, valid_id_url,
      created_at,
      ${USER_JOIN}(id, email)
    `)
    .eq('verification_status', 'rejected')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Get a single resident's full profile for verification review.
 */
const getResidentDetail = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('resident_profiles')
    .select(`
      id, user_id, first_name, middle_name, last_name, suffix,
      phone, address, civil_status, date_of_birth,
      valid_id_url, verification_status, rejection_reason,
      verified_by, verified_at, created_at,
      ${USER_JOIN}(id, email, created_at)
    `)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new NotFoundError('Resident not found');
  return data;
};

/**
 * Approve or reject a resident's verification.
 */
const verifyAccount = async ({ residentUserId, status, rejectionReason, staffId, staffName, ipAddress }) => {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('resident_profiles')
    .select(`*, ${USER_JOIN}(id, email)`)
    .eq('user_id', residentUserId)
    .single();

  if (fetchErr || !profile) throw new NotFoundError('Resident profile not found');
  if (profile.verification_status !== 'pending') {
    throw new BadRequestError('Account is not pending verification');
  }

  if (status === 'verified' && !profile.valid_id_url) {
    throw new BadRequestError('Cannot approve: resident has not uploaded a valid ID');
  }

  const isApproved = status === 'verified';
  const residentName = `${profile.first_name} ${profile.last_name}`;

  const profileUpdate = {
    verification_status: status,
    verified_by: isApproved ? staffId : null,
    verified_at: isApproved ? new Date().toISOString() : null,
    rejection_reason: isApproved ? null : rejectionReason,
  };

  const { error: updateErr } = await supabaseAdmin
    .from('resident_profiles')
    .update(profileUpdate)
    .eq('user_id', residentUserId);

  if (updateErr) throw updateErr;

  if (isApproved) {
    await supabaseAdmin
      .from('users')
      .update({ is_verified: true })
      .eq('id', residentUserId);
  }

  await auditService.createLog({
    actorId: staffId,
    actorName: staffName,
    action: isApproved ? 'account.verified' : 'account.verification_rejected',
    targetTable: 'resident_profiles',
    targetId: profile.id,
    detail: isApproved
      ? `Verified ${residentName}`
      : `Rejected ${residentName}: ${rejectionReason}`,
    ipAddress,
  });

  await notifService.createNotification({
    userId: residentUserId,
    title: isApproved ? 'Account Verified' : 'Verification Rejected',
    message: isApproved
      ? 'Your account has been verified! You can now submit document requests.'
      : `Your verification was rejected. Reason: ${rejectionReason}. You may re-upload a clearer ID.`,
    type: 'verification',
  });

  // Access email via the disambiguated join key
  const userEmail = profile.users?.email || profile[USER_JOIN]?.email;
  if (userEmail) {
    emailService.sendVerificationEmail(userEmail, {
      name: residentName,
      approved: isApproved,
      reason: rejectionReason,
    });
  }

  return { status, residentName };
};

/**
 * Re-submit verification after rejection (resident re-uploads ID).
 * Resets status back to 'pending' so staff can review again.
 */
const resubmitVerification = async ({ residentUserId, validIdUrl }) => {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('resident_profiles')
    .select('verification_status, first_name, last_name')
    .eq('user_id', residentUserId)
    .single();

  if (fetchErr || !profile) throw new NotFoundError('Profile not found');
  if (profile.verification_status !== 'rejected') {
    throw new BadRequestError('Can only re-submit after rejection');
  }

  const { error: updateErr } = await supabaseAdmin
    .from('resident_profiles')
    .update({
      valid_id_url: validIdUrl,
      verification_status: 'pending',
      rejection_reason: null,
    })
    .eq('user_id', residentUserId);

  if (updateErr) throw updateErr;

  const residentName = `${profile.first_name} ${profile.last_name}`;

  await auditService.createLog({
    actorId: residentUserId,
    actorName: residentName,
    action: 'account.resubmitted_verification',
    targetTable: 'resident_profiles',
    detail: 'Re-uploaded valid ID for verification',
  });

  const staffIds = await notifService.getStaffAndAdminIds();
  await notifService.notifyMany(staffIds, {
    title: 'Verification Re-submitted',
    message: `${residentName} re-uploaded their valid ID after rejection. Please review.`,
    type: 'verification_resubmit',
    referenceId: residentUserId,
  });

  return { status: 'pending', residentName };
};

module.exports = {
  getPending,
  getVerified,
  getRejected,
  getResidentDetail,
  verifyAccount,
  resubmitVerification,
};