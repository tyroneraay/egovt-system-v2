const { supabaseAdmin } = require('../config/supabase');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const auditService = require('./audit.service');
const notifService = require('./notification.service');

/**
 * Submit payment (resident).
 */
const submitPayment = async ({ requestId, method, proofUrl, residentId, residentName, ipAddress }) => {
  // Get request
  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('requests')
    .select('*, document_types(name)')
    .eq('id', requestId)
    .single();

  if (fetchErr || !request) throw new NotFoundError('Request not found');
  if (request.resident_id !== residentId) throw new BadRequestError('Not your request');
  if (request.status !== 'awaiting_payment') throw new BadRequestError('Request is not awaiting payment');

  // Check no existing payment
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('request_id', requestId)
    .single();

  if (existing) throw new BadRequestError('Payment already submitted for this request');

  // Validate GCash requires proof
  if (method === 'gcash' && !proofUrl) {
    throw new BadRequestError('GCash payment requires proof upload');
  }

  // Create payment record
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      request_id: requestId,
      amount: request.fee,
      method,
      proof_url: proofUrl || null,
      status: 'submitted',
    })
    .select('*')
    .single();

  if (error) throw error;

  const docName = request.document_types?.name || 'Document';

  // Audit log
  await auditService.createLog({
    actorId: residentId,
    actorName: residentName,
    action: 'payment.submitted',
    targetTable: 'payments',
    targetId: payment.id,
    detail: `${method === 'gcash' ? 'GCash' : 'Walk-in'} — ₱${request.fee} — ${docName}`,
    ipAddress,
  });

  // Notify staff
  const staffIds = await notifService.getStaffAndAdminIds();
  await notifService.notifyMany(staffIds, {
    title: 'Payment Submitted',
    message: `${residentName} submitted ${method === 'gcash' ? 'GCash' : 'walk-in'} payment for ${docName} (₱${request.fee}).`,
    type: 'payment_submitted',
    referenceId: requestId,
  });

  return payment;
};

/**
 * Verify or reject payment (staff/admin).
 */
const verifyPayment = async ({ paymentId, status, staffId, staffName, ipAddress }) => {
  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('*, requests(id, resident_id, fee, document_type_id, status, document_types(name))')
    .eq('id', paymentId)
    .single();

  if (fetchErr || !payment) throw new NotFoundError('Payment not found');
  if (payment.status !== 'submitted') throw new BadRequestError('Payment is not in submitted status');

  // Update payment
  const updateData = {
    status,
    verified_by: staffId,
    verified_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabaseAdmin
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (updateErr) throw updateErr;

  const docName = payment.requests?.document_types?.name || 'Document';

  // If verified, move request to 'paid'
  if (status === 'verified') {
    await supabaseAdmin
      .from('requests')
      .update({ status: 'paid' })
      .eq('id', payment.request_id);

    await notifService.createNotification({
      userId: payment.requests.resident_id,
      title: 'Payment Verified',
      message: `Your payment of ₱${payment.amount} for ${docName} has been verified.`,
      type: 'payment_verified',
      referenceId: payment.request_id,
    });
  } else {
    await notifService.createNotification({
      userId: payment.requests.resident_id,
      title: 'Payment Rejected',
      message: `Your payment for ${docName} was rejected. Please resubmit.`,
      type: 'payment_rejected',
      referenceId: payment.request_id,
    });
  }

  // Audit
  await auditService.createLog({
    actorId: staffId,
    actorName: staffName,
    action: `payment.${status}`,
    targetTable: 'payments',
    targetId: paymentId,
    detail: `${docName} — ₱${payment.amount} — ${status}`,
    ipAddress,
  });

  return { ...payment, status };
};

module.exports = { submitPayment, verifyPayment };
