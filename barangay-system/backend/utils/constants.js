// ============================================================
// CONSTANTS
// ============================================================

const USER_ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  RESIDENT: 'resident',
};

const REQUEST_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  READY: 'ready',
  RELEASED: 'released',
  REJECTED: 'rejected',
};

// Valid status transitions (from → allowed destinations)
const STATUS_TRANSITIONS = {
  pending: ['under_review', 'rejected'],
  under_review: ['awaiting_payment', 'paid', 'rejected'], // paid for free docs
  awaiting_payment: ['paid', 'rejected'],
  paid: ['processing'],
  processing: ['ready'],
  ready: ['released'],
  released: [],
  rejected: [],
};

const PAYMENT_METHODS = {
  GCASH: 'gcash',
  WALK_IN: 'walk_in',
  FREE: 'free',
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

// Editable statuses for staff (request details)
const EDITABLE_STATUSES = ['under_review', 'processing'];

module.exports = {
  USER_ROLES,
  REQUEST_STATUS,
  STATUS_TRANSITIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  VERIFICATION_STATUS,
  EDITABLE_STATUSES,
};
