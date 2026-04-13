const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { validate, schemas } = require('../middleware/validate');
const staffService = require('../services/staff.service');
const auditService = require('../services/audit.service');
const { supabaseAdmin } = require('../config/supabase');

// ── Dashboard Stats ──
// GET /api/admin/dashboard
router.get('/dashboard', authenticate, roleGuard('admin', 'staff'), async (req, res, next) => {
  try {
    // Request counts by status
    const { data: requests } = await supabaseAdmin
      .from('requests')
      .select('status');

    const statusCounts = {};
    (requests || []).forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    // Revenue
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'verified');

    const revenue = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Staff count
    const { count: staffCount } = await supabaseAdmin
      .from('staff_profiles')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    // Pending verifications
    const { count: pendingVerifications } = await supabaseAdmin
      .from('resident_profiles')
      .select('id', { count: 'exact' })
      .eq('verification_status', 'pending');

    res.json({
      data: {
        statusCounts,
        totalRequests: requests?.length || 0,
        revenue,
        activeStaff: staffCount || 0,
        pendingVerifications: pendingVerifications || 0,
      },
    });
  } catch (err) { next(err); }
});

// ── Staff Management ──
// GET /api/admin/staff
router.get('/staff', authenticate, roleGuard('admin'), async (req, res, next) => {
  try {
    const data = await staffService.getAllStaff();
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/admin/staff
router.post('/staff',
  authenticate,
  roleGuard('admin'),
  validate(schemas.createStaff),
  async (req, res, next) => {
    try {
      const data = await staffService.createStaff({
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        position: req.body.position,
        adminId: req.user.id,
        adminName: req.user.email,
        ipAddress: req.ip,
      });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// DELETE /api/admin/staff/:userId
router.delete('/staff/:userId',
  authenticate,
  roleGuard('admin'),
  async (req, res, next) => {
    try {
      const data = await staffService.deleteStaff({
        staffUserId: req.params.userId,
        adminId: req.user.id,
        adminName: req.user.email,
        ipAddress: req.ip,
      });
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// PUT /api/admin/staff/:userId
router.put('/staff/:userId',
  authenticate,
  roleGuard('admin'),
  validate(schemas.updateStaff),
  async (req, res, next) => {
    try {
      const data = await staffService.updateStaff({
        staffUserId: req.params.userId,
        updates: req.body,
        adminId: req.user.id,
        adminName: req.user.email,
        ipAddress: req.ip,
      });
      res.json({ data });
    } catch (err) { next(err); }
  }
);

// ── Audit Logs ──
// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, roleGuard('admin'), async (req, res, next) => {
  try {
    const { page, limit, from, to } = req.query;
    const data = await auditService.getLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      from,
      to,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/admin/audit-logs/export?groupBy=daily|weekly|monthly|yearly&from=&to=
router.get('/audit-logs/export', authenticate, roleGuard('admin'), async (req, res, next) => {
  try {
    const { groupBy = 'daily', from, to } = req.query;
    const buffer = await auditService.exportLogs({ groupBy, from, to });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${groupBy}-${Date.now()}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// ── Document Types ──
// GET /api/admin/document-types
router.get('/document-types', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('document_types')
      .select('*')
      .eq('is_active', true)
      .order('id');

    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
