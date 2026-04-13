const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { validate, schemas } = require('../middleware/validate');
const paymentService = require('../services/payment.service');
const { supabaseAdmin } = require('../config/supabase');

// Multer for file upload (GCash proof)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// POST /api/payments/:requestId — submit payment (resident)
router.post('/:requestId',
  authenticate,
  roleGuard('resident'),
  upload.single('proof'),
  validate(schemas.submitPayment),
  async (req, res, next) => {
    try {
      let proofUrl = null;

      // Upload proof to Supabase Storage if GCash
      if (req.body.method === 'gcash' && req.file) {
        const fileName = `${req.params.requestId}_${Date.now()}.${req.file.mimetype.split('/')[1]}`;
        const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabaseAdmin.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);

        proofUrl = urlData.publicUrl;
      }

      // Get resident name
      const { data: profile } = await supabaseAdmin
        .from('resident_profiles')
        .select('first_name, last_name')
        .eq('user_id', req.user.id)
        .single();
      const residentName = profile ? `${profile.first_name} ${profile.last_name}` : req.user.email;

      const data = await paymentService.submitPayment({
        requestId: req.params.requestId,
        method: req.body.method,
        proofUrl,
        residentId: req.user.id,
        residentName,
        ipAddress: req.ip,
      });

      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// PUT /api/payments/:id/verify — verify or reject payment (staff/admin)
router.put('/:id/verify',
  authenticate,
  roleGuard('staff', 'admin'),
  validate(schemas.verifyPayment),
  async (req, res, next) => {
    try {
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('first_name, last_name')
        .eq('user_id', req.user.id)
        .single();
      const staffName = staffProfile
        ? `${staffProfile.first_name} ${staffProfile.last_name}`
        : req.user.email;

      const data = await paymentService.verifyPayment({
        paymentId: req.params.id,
        status: req.body.status,
        staffId: req.user.id,
        staffName,
        ipAddress: req.ip,
      });

      res.json({ data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
