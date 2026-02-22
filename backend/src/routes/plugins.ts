import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/plugins', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('plugin_registry')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ plugins: data || [] });
  } catch (err) {
    console.error('Error fetching plugins:', err);
    res.status(500).json({ error: 'Failed to fetch plugins' });
  }
});

router.get('/plugins/:id', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { data, error } = await supabase
      .from('plugin_registry')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    res.json(data);
  } catch (err) {
    console.error('Error fetching plugin:', err);
    res.status(500).json({ error: 'Failed to fetch plugin' });
  }
});

router.post(
  '/plugins',
  [
    body('name').notEmpty().trim(),
    body('description').optional().trim(),
    body('type').isIn(['panel', 'widget', 'action']),
    body('config').optional().isObject(),
    body('mount_point').optional().trim(),
  ],
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const id = uuidv4();
      const { name, description = '', type, config = {}, mount_point = '' } = req.body;

      const { error: insertError } = await supabase.from('plugin_registry').insert({
        id,
        name,
        description,
        type,
        enabled: false,
        config,
        mount_point,
      });
      if (insertError) throw new Error(insertError.message);

      await logAudit({
        entityType: 'plugin',
        entityId: id,
        action: 'create',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { name, type },
      });

      const { data } = await supabase.from('plugin_registry').select('*').eq('id', id).single();
      res.status(201).json(data);
    } catch (err) {
      console.error('Error creating plugin:', err);
      res.status(500).json({ error: 'Failed to create plugin' });
    }
  }
);

router.put(
  '/plugins/:id',
  [
    param('id').isUUID(),
    body('enabled').optional().isBoolean(),
    body('config').optional().isObject(),
    body('description').optional().trim(),
    body('mount_point').optional().trim(),
  ],
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('plugin_registry')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Plugin not found' });
      }

      const fields = ['enabled', 'config', 'description', 'mount_point'];
      const updateObj: Record<string, unknown> = {};

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updateObj[field] = req.body[field];
        }
      }

      if (Object.keys(updateObj).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { error: updateError } = await supabase
        .from('plugin_registry')
        .update(updateObj)
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'plugin',
        entityId: req.params.id,
        action: 'update',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { updated_fields: Object.keys(req.body).filter(k => fields.includes(k)) },
      });

      const { data } = await supabase.from('plugin_registry').select('*').eq('id', req.params.id).single();
      res.json(data);
    } catch (err) {
      console.error('Error updating plugin:', err);
      res.status(500).json({ error: 'Failed to update plugin' });
    }
  }
);

export default router;
