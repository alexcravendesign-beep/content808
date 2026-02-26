import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../services/audit';
import { checkAutoTransition } from '../services/auto-status';

const router = Router();

router.get('/items/:id/comments', [param('id').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { data, error } = await supabase
      .from('content_comments')
      .select('*')
      .eq('content_item_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ comments: data || [] });
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
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const id = uuidv4();
      const { error: insertError } = await supabase.from('content_comments').insert({
        id,
        content_item_id: req.params.id,
        user_id: req.user!.id,
        user_name: req.user!.name,
        body: req.body.body,
      });
      if (insertError) throw new Error(insertError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'comment',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { comment_id: id },
      });

      const { data } = await supabase.from('content_comments').select('*').eq('id', id).single();
      res.status(201).json(data);
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
    const { data, error } = await supabase
      .from('content_item_outputs')
      .select('*')
      .eq('content_item_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ outputs: data || [] });
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
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const id = uuidv4();
      const { error: insertError } = await supabase.from('content_item_outputs').insert({
        id,
        content_item_id: req.params.id,
        output_type: req.body.output_type,
        output_data: req.body.output_data,
      });
      if (insertError) throw new Error(insertError.message);

      const { data } = await supabase.from('content_item_outputs').select('*').eq('id', id).single();

      const outputStatus = (req.body?.output_data?.status as string) || 'completed';
      if (outputStatus === 'completed') {
        await checkAutoTransition(req.params.id);
      }

      res.status(201).json(data);
    } catch (err) {
      console.error('Error creating output:', err);
      res.status(500).json({ error: 'Failed to create output' });
    }
  }
);

router.delete('/items/:id/outputs/:outputId', [param('id').isUUID(), param('outputId').isUUID()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('content_item_outputs')
      .select('id,content_item_id')
      .eq('id', req.params.outputId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing || existing.content_item_id !== req.params.id) {
      return res.status(404).json({ error: 'Output not found' });
    }

    const { error: delError } = await supabase
      .from('content_item_outputs')
      .delete()
      .eq('id', req.params.outputId);
    if (delError) throw new Error(delError.message);

    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting output:', err);
    res.status(500).json({ error: 'Failed to delete output' });
  }
});

export default router;
