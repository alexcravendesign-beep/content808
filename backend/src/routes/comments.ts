import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/items/:id/comments', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const result = await query(
      'SELECT * FROM content_comments WHERE content_item_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post(
  '/items/:id/comments',
  [
    param('id').isUUID(),
    body('body').notEmpty().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const existing = await query('SELECT id FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const id = uuidv4();
      await query(
        'INSERT INTO content_comments (id, content_item_id, user_id, user_name, body) VALUES ($1, $2, $3, $4, $5)',
        [id, req.params.id, req.user!.id, req.user!.name, req.body.body]
      );

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'comment',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { comment_id: id },
      });

      const result = await query('SELECT * FROM content_comments WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error creating comment:', err);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

router.get('/items/:id/outputs', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const result = await query(
      'SELECT * FROM content_item_outputs WHERE content_item_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ outputs: result.rows });
  } catch (err) {
    console.error('Error fetching outputs:', err);
    res.status(500).json({ error: 'Failed to fetch outputs' });
  }
});

router.post(
  '/items/:id/outputs',
  [
    param('id').isUUID(),
    body('output_type').notEmpty().trim(),
    body('output_data').isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const existing = await query('SELECT id FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const id = uuidv4();
      await query(
        'INSERT INTO content_item_outputs (id, content_item_id, output_type, output_data) VALUES ($1, $2, $3, $4)',
        [id, req.params.id, req.body.output_type, JSON.stringify(req.body.output_data)]
      );

      const result = await query('SELECT * FROM content_item_outputs WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error creating output:', err);
      res.status(500).json({ error: 'Failed to create output' });
    }
  }
);

export default router;
