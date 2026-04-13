const { supabaseAdmin } = require('../config/supabase');
const { STATUS_TRANSITIONS, EDITABLE_STATUSES } = require('../utils/constants');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const auditService = require('./audit.service');
const notifService = require('./notification.service');
const emailService = require('./email.service');

/**
 * Helper: get resident name from resident_profiles by user_id
 */
const getResidentName = async (userId) => {
  const { data } = await supabaseAdmin
    .from('resident_profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .single();
  return data ? `${data.first_name} ${data.last_name}` : 'Unknown';
};

/**
 * Helper: get staff name from staff_profiles by user_id
 */
const getStaffName = async (userId) => {
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('staff_profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .single();
  return data ? `${data.first_name} ${data.last_name}` : null;
};

/**
 * Helper: batch-fetch resident names for a list of user IDs
 */
const batchResidentNames = async (userIds) => {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabaseAdmin
    .from('resident_profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', unique);
  const map = {};
  (data || []).forEach(r => { map[r.user_id] = `${r.first_name} ${r.last_name}`; });
  return map;
};

/**
 * Helper: batch-fetch staff names for a list of user IDs
 */
const batchStaffNames = async (userIds) => {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabaseAdmin
    .from('staff_profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', unique);
  const map = {};
  (data || []).forEach(s => { map[s.user_id] = `${s.first_name} ${s.last_name}`; });
  return map;
};

/**
 * Create a new document request (resident).
 */
const createRequest = async ({ residentId, documentTypeId, purpose, ipAddress }) => {
  const { data: docType, error: dtErr } = await supabaseAdmin
    .from('document_types')
    .select('id, name, fee, is_active')
    .eq('id', documentTypeId)
    .single();

  if (dtErr || !docType) throw new NotFoundError('Document type not found');
  if (!docType.is_active) throw new BadRequestError('This document type is not available');

  const { data: request, error } = await supabaseAdmin
    .from('requests')
    .insert({
      resident_id: residentId,
      document_type_id: documentTypeId,
      purpose,
      fee: docType.fee,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;

  const residentName = await getResidentName(residentId);

  await auditService.createLog({
    actorId: residentId,
    actorName: residentName,
    action: 'request.created',
    targetTable: 'requests',
    targetId: request.id,
    detail: `Submitted ${docType.name} — ${purpose}`,
    ipAddress,
  });

  const staffIds = await notifService.getStaffAndAdminIds();
  await notifService.notifyMany(staffIds, {
    title: 'New Request Submitted',
    message: `${residentName} requests ${docType.name} — "${purpose}"`,
    type: 'new_request',
    referenceId: request.id,
  });

  return { ...request, document_type: docType };
};

/**
 * Update request status (staff/admin).
 * Handles free document auto-skip: under_review → paid (skip awaiting_payment).
 */
const updateStatus = async ({ requestId, newStatus, rejectionReason, remarks, staffId, staffName, ipAddress }) => {
  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('requests')
    .select('*, document_types(name, fee)')
    .eq('id', requestId)
    .single();

  if (fetchErr || !request) throw new NotFoundError('Request not found');

  const currentStatus = request.status;
  let finalStatus = newStatus;
  let autoSkipped = false;

  if (newStatus === 'awaiting_payment' && request.fee === 0) {
    finalStatus = 'paid';
    autoSkipped = true;
  }

  const allowed = STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(finalStatus)) {
    throw new BadRequestError(`Cannot transition from "${currentStatus}" to "${finalStatus}"`);
  }

  const update = {
    status: finalStatus,
    assigned_staff_id: request.assigned_staff_id || staffId,
  };

  if (finalStatus === 'rejected') update.rejection_reason = rejectionReason;
  if (remarks) update.remarks = remarks;

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('requests')
    .update(update)
    .eq('id', requestId)
    .select('*')
    .single();

  if (updateErr) throw updateErr;

  if (autoSkipped) {
    await supabaseAdmin.from('payments').insert({
      request_id: requestId,
      amount: 0,
      method: 'free',
      status: 'verified',
      verified_by: staffId,
      verified_at: new Date().toISOString(),
    });
  }

  const docName = request.document_types?.name || 'Document';

  await auditService.createLog({
    actorId: staffId,
    actorName: staffName,
    action: `request.${finalStatus}`,
    targetTable: 'requests',
    targetId: requestId,
    oldValue: { status: currentStatus },
    newValue: { status: finalStatus },
    detail: autoSkipped
      ? `${docName} — Free document, auto-skipped to Paid`
      : `${docName} — ${currentStatus} → ${finalStatus}`,
    ipAddress,
  });

  const { data: residentUser } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', request.resident_id)
    .single();

  const statusLabels = {
    under_review: 'Under Review', awaiting_payment: 'Awaiting Payment',
    paid: 'Paid', processing: 'Processing', ready: 'Ready for Release',
    released: 'Released', rejected: 'Rejected',
  };

  await notifService.createNotification({
    userId: request.resident_id,
    title: `Request ${statusLabels[finalStatus]}`,
    message: autoSkipped
      ? `Your ${docName} is free of charge and has been approved for processing.`
      : `Your ${docName} is now "${statusLabels[finalStatus]}".${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    type: 'status_change',
    referenceId: requestId,
  });

  if (residentUser?.email) {
    emailService.sendRequestStatusEmail(residentUser.email, { docName, status: finalStatus, reason: rejectionReason });
    if (finalStatus === 'released') {
      const { data: latestDoc } = await supabaseAdmin
        .from('request_documents')
        .select('file_url')
        .eq('request_id', requestId)
        .eq('is_draft', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      emailService.sendDocumentReleasedEmail(residentUser.email, {
        docName,
        downloadUrl: latestDoc?.file_url || null,
      });
    }
  }

  return updated;
};

/**
 * Edit request details (staff/admin, only during under_review or processing).
 */
const editRequest = async ({ requestId, updates, staffId, staffName, ipAddress }) => {
  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('requests')
    .select('*, document_types(name, fee)')
    .eq('id', requestId)
    .single();

  if (fetchErr || !request) throw new NotFoundError('Request not found');
  if (!EDITABLE_STATUSES.includes(request.status)) {
    throw new ForbiddenError(`Cannot edit request in "${request.status}" status`);
  }

  const oldValues = {};
  const newValues = {};
  const changes = [];

  if (updates.document_type_id && updates.document_type_id !== request.document_type_id) {
    const { data: newDocType, error: dtErr } = await supabaseAdmin
      .from('document_types')
      .select('id, name, fee')
      .eq('id', updates.document_type_id)
      .single();
    if (dtErr || !newDocType) throw new NotFoundError('Document type not found');

    oldValues.document_type_id = request.document_type_id;
    newValues.document_type_id = newDocType.id;
    updates.fee = newDocType.fee;
    changes.push(`Document: ${request.document_types?.name} → ${newDocType.name}`);
    changes.push(`Fee: ₱${request.fee} → ₱${newDocType.fee}`);
  }

  if (updates.purpose && updates.purpose !== request.purpose) {
    oldValues.purpose = request.purpose;
    newValues.purpose = updates.purpose;
    changes.push('Purpose updated');
  }

  if (changes.length === 0 && !updates.remarks) throw new BadRequestError('No changes detected');

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('requests')
    .update(updates)
    .eq('id', requestId)
    .select('*')
    .single();

  if (updateErr) throw updateErr;

  await auditService.createLog({
    actorId: staffId, actorName: staffName, action: 'request.edited',
    targetTable: 'requests', targetId: requestId,
    oldValue: oldValues, newValue: newValues,
    detail: changes.join(', ') || 'Remarks updated', ipAddress,
  });

  await notifService.createNotification({
    userId: request.resident_id,
    title: 'Request Updated',
    message: `Your document request has been updated by staff. Changes: ${changes.join(', ') || 'Remarks added'}`,
    type: 'request_edited', referenceId: requestId,
  });

  return updated;
};

/**
 * Get requests — scoped by role.
 * Uses separate batch queries for resident/staff names since PostgREST
 * cannot traverse requests.resident_id → users → resident_profiles.
 */
const getRequests = async ({ userId, role, status, page = 1, limit = 20, search }) => {
  // Simple query — only direct FK joins that work
  let query = supabaseAdmin
    .from('requests')
    .select(`
      *,
      document_types(id, name, fee),
      payments(id, amount, method, status, proof_url)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (role === 'resident') {
    query = query.eq('resident_id', userId);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`purpose.ilike.%${search}%`);
  }

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  // Batch-fetch resident and staff names
  const residentIds = (data || []).map(r => r.resident_id);
  const staffIds = (data || []).map(r => r.assigned_staff_id);
  const [residentNames, staffNames] = await Promise.all([
    batchResidentNames(residentIds),
    batchStaffNames(staffIds),
  ]);

  // Attach names to each request
  const enriched = (data || []).map(r => ({
    ...r,
    resident_name: residentNames[r.resident_id] || 'Unknown',
    staff_name: staffNames[r.assigned_staff_id] || null,
  }));

  return { data: enriched, total: count, page, limit };
};

/**
 * Get single request by ID (with names).
 */
const getRequestById = async (requestId) => {
  const { data, error } = await supabaseAdmin
    .from('requests')
    .select(`
      *,
      document_types(id, name, fee, description),
      payments(id, amount, method, status, proof_url, verified_by, verified_at, created_at),
      request_documents(id, file_url, version, is_draft, created_at)
    `)
    .eq('id', requestId)
    .single();

  if (error || !data) throw new NotFoundError('Request not found');

  // Fetch names
  const [residentName, staffName] = await Promise.all([
    getResidentName(data.resident_id),
    getStaffName(data.assigned_staff_id),
  ]);

  return {
    ...data,
    resident_name: residentName,
    staff_name: staffName,
  };
};

module.exports = {
  createRequest,
  updateStatus,
  editRequest,
  getRequests,
  getRequestById,
};