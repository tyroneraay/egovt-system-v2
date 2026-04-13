const Joi = require('joi');

/**
 * Generic validation middleware factory.
 * Usage: validate(schema) where schema validates req.body
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: messages,
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Query param validation
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: messages,
      });
    }

    req.query = value;
    next();
  };
};

// ============================================================
// SCHEMAS
// ============================================================

const schemas = {
  // Auth
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().min(1).max(100).required(),
    middle_name: Joi.string().max(100).allow('', null),
    last_name: Joi.string().min(1).max(100).required(),
    suffix: Joi.string().max(20).allow('', null),
    phone: Joi.string().max(20).allow('', null),
    address: Joi.string().allow('', null),
    civil_status: Joi.string().valid('Single', 'Married', 'Widowed', 'Separated').allow(null),
    date_of_birth: Joi.date().allow(null),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(6).required(),
  }),

  // Requests
  createRequest: Joi.object({
    document_type_id: Joi.number().integer().positive().required(),
    purpose: Joi.string().min(3).max(500).required(),
  }),

  updateRequestStatus: Joi.object({
    status: Joi.string().valid(
      'under_review', 'awaiting_payment', 'paid',
      'processing', 'ready', 'released', 'rejected'
    ).required(),
    rejection_reason: Joi.string().max(500).when('status', {
      is: 'rejected',
      then: Joi.required(),
      otherwise: Joi.allow('', null),
    }),
    remarks: Joi.string().max(500).allow('', null),
  }),

  editRequest: Joi.object({
    document_type_id: Joi.number().integer().positive(),
    purpose: Joi.string().min(3).max(500),
    remarks: Joi.string().max(500).allow('', null),
  }).min(1),

  // Payments
  submitPayment: Joi.object({
    method: Joi.string().valid('gcash', 'walk_in').required(),
  }),

  verifyPayment: Joi.object({
    status: Joi.string().valid('verified', 'rejected').required(),
  }),

  // Verification
  verifyAccount: Joi.object({
    status: Joi.string().valid('verified', 'rejected').required(),
    rejection_reason: Joi.string().max(500).when('status', {
      is: 'rejected',
      then: Joi.required(),
      otherwise: Joi.allow('', null),
    }),
  }),

  // Staff management
  createStaff: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().min(1).max(100).required(),
    position: Joi.string().max(100).allow('', null),
  }),

  updateStaff: Joi.object({
    is_active: Joi.boolean(),
    position: Joi.string().max(100).allow('', null),
  }).min(1),

  // Profile
  updateResidentProfile: Joi.object({
    phone: Joi.string().max(20).allow('', null),
    address: Joi.string().allow('', null),
    civil_status: Joi.string().valid('Single', 'Married', 'Widowed', 'Separated').allow(null),
    email: Joi.string().email(),
  }).min(1),

  updateAdminProfile: Joi.object({
    first_name: Joi.string().min(1).max(100),
    last_name: Joi.string().min(1).max(100),
    email: Joi.string().email(),
  }).min(1),
};

module.exports = { validate, validateQuery, schemas };
