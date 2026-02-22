import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const { error } = await supabase.from('migrations').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ready', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
});

export default router;
