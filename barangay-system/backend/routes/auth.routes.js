const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const authService = require('../services/auth.service');
const { supabaseAdmin } = require('../config/supabase');

// Multer for valid ID upload during registration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, or PDF files are allowed'), false);
    }
  },
});

// POST /api/auth/register — with valid ID upload
router.post('/register', upload.single('valid_id'), async (req, res, next) => {
  try {
    // Manual validation since multer runs before validate middleware
    const { email, password, first_name, last_name } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['email, password, first_name, and last_name are required'],
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['Password must be at least 6 characters'],
      });
    }

    // Upload valid ID to Supabase Storage if provided
    let validIdUrl = null;
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1] || 'jpg';
      const fileName = `${Date.now()}_${first_name}_${last_name}.${ext}`.replace(/\s+/g, '_');

      const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
        .from('valid-ids')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadErr) {
        console.error('[UPLOAD] Valid ID upload failed:', uploadErr.message);
      } else {
        const { data: urlData } = supabaseAdmin.storage
          .from('valid-ids')
          .getPublicUrl(fileName);
        validIdUrl = urlData.publicUrl;
      }
    }

    const result = await authService.register({
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.first_name,
      middleName: req.body.middle_name || null,
      lastName: req.body.last_name,
      suffix: req.body.suffix || null,
      phone: req.body.phone || null,
      address: req.body.address || null,
      civilStatus: req.body.civil_status || null,
      dateOfBirth: req.body.date_of_birth || null,
      validIdUrl,
    });

    res.status(201).json({
      message: 'Registration successful! Your account is awaiting verification by barangay staff.',
      data: result,
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id, req.user.role);
    res.json({ data: profile });
  } catch (err) { next(err); }
});

// PUT /api/auth/password
router.put('/password', authenticate, validate(schemas.changePassword), async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body.current_password, req.body.new_password);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, validate(schemas.updateResidentProfile), async (req, res, next) => {
  try {
    if (req.user.role === 'resident') {
      const data = await authService.updateResidentProfile(req.user.id, req.body);
      return res.json({ data });
    }
    if (req.user.role === 'admin') {
      const data = await authService.updateAdminProfile(req.user.id, req.body);
      return res.json({ data });
    }
    res.status(403).json({ error: 'Staff profile edits are limited to password changes only' });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
