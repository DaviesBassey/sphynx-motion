const express = require('express');
const { supabaseAdmin } = require('../../lib/supabase');
const { requireRole } = require('../../middleware/roles');

const router = express.Router();
function audit(adminId, action, targetId, details) {
  supabaseAdmin.from('admin_audit_log')
    .insert({ admin_id: adminId, action, target_type: 'moderation', target_id: String(targetId), details })
    .then(null, err => console.error('[audit]', err));
}

// GET /api/admin/moderation  — queue of pending items
router.get('/', async (req, res) => {
  const { status = 'pending' } = req.query;
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  const { data, error, count } = await supabaseAdmin
    .from('moderation_queue')
    .select('*, profiles!submitter_id(display_name, email), reviewed_by_profile:profiles!reviewed_by(display_name)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data, total: count });
});

// GET /api/admin/moderation/reports — user-submitted reports
router.get('/reports', async (req, res) => {
  const { status = 'pending' } = req.query;
  const pageNum  = Math.max(1, Number(req.query.page)  || 1);
  const limitNum = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset   = (pageNum - 1) * limitNum;

  const { data, error, count } = await supabaseAdmin
    .from('content_reports')
    .select('*, reporter:profiles!reporter_id(display_name)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: data, total: count });
});

// POST /api/admin/moderation/:id/action
router.post('/:id/action', requireRole('admin'), async (req, res) => {
  const { action, reason } = req.body;
  const validActions = ['approve', 'reject', 'dismiss', 'escalate'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  const statusMap = { approve: 'approved', reject: 'rejected', dismiss: 'dismissed', escalate: 'escalated' };

  const { data: item, error: fetchError } = await supabaseAdmin
    .from('moderation_queue')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !item) return res.status(404).json({ error: 'Item not found' });

  const { data, error } = await supabaseAdmin
    .from('moderation_queue')
    .update({ status: statusMap[action], reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), review_reason: reason })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // If approving a creator episode submission, update episode status to 'live'
  if (action === 'approve' && item.submission_type === 'episode' && item.content_id) {
    await supabaseAdmin.from('episodes').update({ status: 'live' }).eq('id', item.content_id);
  }

  // If rejecting a creator submission, notify (stub — connect email/notification service)
  if (action === 'reject' && item.submitter_id) {
    // TODO: send rejection notification via Supabase Edge Function or Resend/Postmark
  }

  audit(req.user.id, `moderation_${action}`, req.params.id, { submission_type: item.submission_type, reason });
  res.json({ item: data });
});

// POST /api/admin/moderation/reports/:id/action
router.post('/reports/:id/action', requireRole('admin'), async (req, res) => {
  const { action } = req.body;
  const validActions = ['dismiss', 'remove_content', 'warn_user', 'suspend_user'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  const { data: report, error: fetchError } = await supabaseAdmin
    .from('content_reports')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError) return res.status(404).json({ error: 'Report not found' });

  const { error: resolveErr } = await supabaseAdmin.from('content_reports')
    .update({ status: 'resolved', resolved_by: req.user.id, resolved_at: new Date().toISOString(), resolution: action })
    .eq('id', req.params.id);
  if (resolveErr) return res.status(500).json({ error: resolveErr.message });

  if (action === 'suspend_user' && report.reported_user_id) {
    const { error: suspendErr } = await supabaseAdmin.from('profiles').update({ is_suspended: true, suspension_reason: `Content violation: ${report.reason}` }).eq('id', report.reported_user_id);
    if (suspendErr) console.error('[moderation] suspend error:', suspendErr.message);
  }

  audit(req.user.id, `report_${action}`, req.params.id, { reason: report.reason });
  res.json({ success: true });
});

module.exports = router;
