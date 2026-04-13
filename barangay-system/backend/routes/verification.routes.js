const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { validate, schemas } = require('../middleware/validate');
const verificationService = require('../services/verification.service');
const { supabaseAdmin } = require('../config/supabase');

// Multer for ID re-upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WebP, or PDF files are allowed'), false);
  },
});

// GET /api/verification/pending — staff/admin
router.get('/pending', authenticate, roleGuard('staff', 'admin'), async (req, res, next) => {
  try {
    const data = await verificationService.getPending();
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/verification/verified — staff/admin
router.get('/verified', authenticate, roleGuard('staff', 'admin'), async (req, res, next) => {
  try {
    const data = await verificationService.getVerified();
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/verification/rejected — staff/admin
router.get('/rejected', authenticate, roleGuard('staff', 'admin'), async (req, res, next) => {
  try {
    const data = await verificationService.getRejected();
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/verification/:userId — get full resident detail for review
router.get('/:userId', authenticate, roleGuard('staff', 'admin'), async (req, res, next) => {
  try {
    const data = await verificationService.getResidentDetail(req.params.userId);
    res.json({ data });
  } catch (err) { next(err); }
});

// PUT /api/verification/:userId — approve or reject
router.put('/:userId',
  authenticate,
  roleGuard('staff', 'admin'),
  validate(schemas.verifyAccount),
  async (req, res, next) => {
    try {
      // Get staff name for audit
      const { data: staffProfile } = await supabaseAdmin
        .from('staff_profiles')
        .select('first_name, last_name')
        .eq('user_id', req.user.id)
        .single();
      const staffName = staffProfile
        ? `${staffProfile.first_name} ${staffProfile.last_name}`
        : req.user.email;

      const data = await verificationService.verifyAccount({
        residentUserId: req.params.userId,
        status: req.body.status,
        rejectionReason: req.body.rejection_reason,
        staffId: req.user.id,
        staffName,
        ipAddress: req.ip,
      });

      res.json({ message: `Account ${data.status}`, data });
    } catch (err) { next(err); }
  }
);

// POST /api/verification/resubmit — resident re-uploads valid ID after rejection
router.post('/resubmit',
  authenticate,
  roleGuard('resident'),
  upload.single('valid_id'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Valid ID file is required' });
      }

      // Upload to Supabase Storage
      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const fileName = `resubmit_${req.user.id}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('valid-ids')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadErr) {
        console.error('[UPLOAD] Re-upload failed:', uploadErr.message);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('valid-ids')
        .getPublicUrl(fileName);

      const data = await verificationService.resubmitVerification({
        residentUserId: req.user.id,
        validIdUrl: urlData.publicUrl,
      });

      res.json({
        message: 'Valid ID re-submitted. Your account is now pending verification.',
        data,
      });
    } catch (err) { next(err); }
  }
);

module.exports = router;
