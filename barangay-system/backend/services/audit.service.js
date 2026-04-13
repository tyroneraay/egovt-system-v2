const { supabaseAdmin } = require('../config/supabase');

/**
 * Append an audit log entry (insert-only, never update/delete).
 */
const createLog = async ({ actorId, actorName, action, targetTable, targetId, oldValue, newValue, detail, ipAddress }) => {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    actor_id: actorId,
    actor_name: actorName,
    action,
    target_table: targetTable || null,
    target_id: targetId || null,
    old_value: oldValue || null,
    new_value: newValue || null,
    detail: detail || null,
    ip_address: ipAddress || null,
  });

  if (error) {
    console.error('[AUDIT] Failed to write log:', error.message);
  }
};

/**
 * List audit logs with pagination and optional date filtering.
 */
const getLogs = async ({ page = 1, limit = 50, from, to }) => {
  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, page, limit };
};

/**
 * Build an .xlsx workbook of audit logs grouped by daily/weekly/monthly/yearly.
 * Returns a Buffer suitable for streaming to the client.
 */
const exportLogs = async ({ groupBy = 'daily', from, to }) => {
  const ExcelJS = require('exceljs');

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  const bucketKey = (iso) => {
    const d = new Date(iso);
    if (groupBy === 'yearly') return String(d.getFullYear());
    if (groupBy === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (groupBy === 'weekly') {
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return d.toISOString().slice(0, 10); // daily
  };

  const buckets = {};
  (data || []).forEach((row) => {
    const k = bucketKey(row.created_at);
    (buckets[k] = buckets[k] || []).push(row);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Barangay Document System';
  workbook.created = new Date();

  const sheetNames = Object.keys(buckets).sort().reverse();
  if (sheetNames.length === 0) sheetNames.push('Empty');

  sheetNames.forEach((name) => {
    const ws = workbook.addWorksheet(name.substring(0, 31));
    ws.columns = [
      { header: 'Timestamp', key: 'created_at', width: 22 },
      { header: 'Actor', key: 'actor_name', width: 24 },
      { header: 'Action', key: 'action', width: 22 },
      { header: 'Target Table', key: 'target_table', width: 18 },
      { header: 'Target ID', key: 'target_id', width: 38 },
      { header: 'Detail', key: 'detail', width: 50 },
      { header: 'IP', key: 'ip_address', width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    (buckets[name] || []).forEach((row) => ws.addRow(row));
  });

  return await workbook.xlsx.writeBuffer();
};

module.exports = { createLog, getLogs, exportLogs };
