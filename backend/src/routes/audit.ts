import { Router, Request, Response } from 'express';
import { getRecentAuditLog } from '../services/audit';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/audit', requireRole('manager', 'admin'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = await getRecentAuditLog(Math.min(limit, 200));
    res.json({ entries });
  } catch (err) {
    console.error('Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
