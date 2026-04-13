const { supabaseAdmin } = require('../config/supabase');

/**
 * Create a notification for a user.
 * This insert triggers Supabase Realtime — the frontend receives it instantly.
 */
const createNotification = async ({ userId, title, message, type = 'general', referenceId = null }) => {
  const { data, error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
  }).select().single();

  if (error) {
    console.error('[NOTIFY] Failed:', error.message);
    return null;
  }
  return data;
};

/**
 * Notify multiple users at once.
 */
const notifyMany = async (userIds, { title, message, type = 'general', referenceId = null }) => {
  const rows = userIds.map((userId) => ({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
  }));

  const { error } = await supabaseAdmin.from('notifications').insert(rows);
  if (error) {
    console.error('[NOTIFY] Bulk failed:', error.message);
  }
};

/**
 * Get all staff and admin user IDs (for broadcasting notifications).
 */
const getStaffAndAdminIds = async () => {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('role', ['staff', 'admin']);

  if (error) return [];
  return data.map((u) => u.id);
};

/**
 * Get notifications for a user.
 */
const getUserNotifications = async (userId, { limit = 50, unreadOnly = false }) => {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

/**
 * Mark notification(s) as read.
 */
const markAsRead = async (notificationId, userId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) throw error;
};

const markAllRead = async (userId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
};

module.exports = {
  createNotification,
  notifyMany,
  getStaffAndAdminIds,
  getUserNotifications,
  markAsRead,
  markAllRead,
};
