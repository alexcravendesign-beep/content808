import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireRole } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/plugins', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM plugin_registry ORDER BY name ASC');
    res.json({ plugins: result.rows });
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
    const result = await query('SELECT * FROM plugin_registry WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plugin not found' });
    }
    res.json(result.rows[0]);
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

      await query(
        `INSERT INTO plugin_registry (id, name, description, type, enabled, config, mount_point)
         VALUES ($1, $2, $3, $4, false, $5, $6)`,
        [id, name, description, type, JSON.stringify(config), mount_point]
      );

      await logAudit({
        entityType: 'plugin',
        entityId: id,
        action: 'create',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { name, type },
      });

      const result = await query('SELECT * FROM plugin_registry WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
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
      const existing = await query('SELECT * FROM plugin_registry WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Plugin not found' });
      }

      const fields = ['enabled', 'config', 'description', 'mount_point'];
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          if (field === 'config') {
            updates.push(`config = $${idx++}`);
            values.push(JSON.stringify(req.body.config));
          } else {
            updates.push(`${field} = $${idx++}`);
            values.push(req.body[field]);
          }
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = NOW()');
      values.push(req.params.id);

      await query(
        `UPDATE plugin_registry SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );

      await logAudit({
        entityType: 'plugin',
        entityId: req.params.id,
        action: 'update',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { updated_fields: Object.keys(req.body).filter(k => fields.includes(k)) },
      });

      const result = await query('SELECT * FROM plugin_registry WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error updating plugin:', err);
      res.status(500).json({ error: 'Failed to update plugin' });
    }
  }
);

export default router;
