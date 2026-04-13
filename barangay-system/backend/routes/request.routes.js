const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { roleGuard, verifiedGuard } = require('../middleware/roleGuard');
const { validate, schemas } = require('../middleware/validate');
const { BadRequestError } = require('../utils/errors');
const requestService = require('../services/request.service');

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');
    if (ok) cb(null, true);
    else cb(new Error('Only PDF or image files are allowed'), false);
  },
});

// GET /api/requests — list (scoped by role)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, page, limit, search } = req.query;
    const data = await requestService.getRequests({
      userId: req.user.id,
      role: req.user.role,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      search,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/requests/:id — single request detail
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const data = await requestService.getRequestById(req.params.id);
    // If resident, check ownership
    if (req.user.role === 'resident' && data.resident_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your request' });
    }
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/requests — create new request (resident only)
router.post('/',
  authenticate,
  roleGuard('resident'),
  verifiedGuard,
  validate(schemas.createRequest),
  async (req, res, next) => {
    try {
      const data = await requestService.createRequest({
        residentId: req.user.id,
        documentTypeId: req.body.document_type_id,
        purpose: req.body.purpose,
        ipAddress: req.ip,
      });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// PUT /api/requests/:id/status — update status (staff/admin)
router.put('/:id/status',
  authenticate,
  roleGuard('staff', 'admin'),
  validate(schemas.updateRequestStatus),
  async (req, res, next) => {
    try {
      if (req.body.status === 'rejected' && !req.body.rejection_reason?.trim()) {
        throw new BadRequestError('Rejection reason is required');
      }
      // Get staff name for audit log
      const { supabaseAdmin } = require('../config/supabase');
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('first_name, last_name')
        .eq('user_id', req.user.id)
        .single();
      const staffName = staffProfile
        ? `${staffProfile.first_name} ${staffProfile.last_name}`
        : req.user.email;

      const data = await requestService.updateStatus({
        requestId: req.params.id,
        newStatus: req.body.status,
        rejectionReason: req.body.rejection_reason,
        remarks: req.body.remarks,
        staffId: req.user.id,
        staffName,
        ipAddress: req.ip,
      });
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// PUT /api/requests/:id/edit — edit request details (staff/admin, under_review or processing only)
router.put('/:id/edit',
  authenticate,
  roleGuard('staff', 'admin'),
  validate(schemas.editRequest),
  async (req, res, next) => {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('first_name, last_name')
        .eq('user_id', req.user.id)
        .single();
      const staffName = staffProfile
        ? `${staffProfile.first_name} ${staffProfile.last_name}`
        : req.user.email;

      const data = await requestService.editRequest({
        requestId: req.params.id,
        updates: req.body,
        staffId: req.user.id,
        staffName,
        ipAddress: req.ip,
      });
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// POST /api/requests/:id/document — staff uploads finished document
router.post('/:id/document',
  authenticate,
  roleGuard('staff', 'admin'),
  documentUpload.single('document'),
  async (req, res, next) => {
    try {
      if (!req.file) throw new BadRequestError('Document file is required');

      const { supabaseAdmin } = require('../config/supabase');
      const ext = req.file.mimetype.split('/')[1];
      const fileName = `${req.params.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('documents')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabaseAdmin.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { data: doc, error: insertErr } = await supabaseAdmin
        .from('request_documents')
        .insert({
          request_id: req.params.id,
          file_url: urlData.publicUrl,
          is_draft: false,
          generated_by: req.user.id,
        })
        .select('*')
        .single();
      if (insertErr) throw insertErr;

      res.status(201).json({ data: doc });
    } catch (err) { next(err); }
  }
);

module.exports = router;
