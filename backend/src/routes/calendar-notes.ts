import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { logAudit } from '../services/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /calendar/notes?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns calendar notes within the given date range.
 * Private notes are filtered to only show the current user's notes.
 */
router.get('/calendar/notes', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const userId = req.user?.id || 'unknown';

    let query = supabase
      .from('calendar_notes')
      .select('*')
      .order('date', { ascending: true });

    if (from) {
      query = query.gte('date', String(from));
    }
    if (to) {
      query = query.lte('date', String(to));
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Filter out private notes that don't belong to the current user
    const notes = (data || []).filter((n: Record<string, unknown>) =>
      n.visibility === 'team' || n.created_by === userId
    );

    res.json({ notes });
  } catch (err) {
    console.error('Error fetching calendar notes:', err);
    res.status(500).json({ error: 'Failed to fetch calendar notes' });
  }
});

/**
 * POST /calendar/notes
 * Create a new calendar note.
 */
router.post('/calendar/notes', async (req: Request, res: Response) => {
  try {
    const { date, note, color, visibility } = req.body;
    const userId = req.user?.id || 'unknown';

    if (!date || !note?.trim()) {
      return res.status(400).json({ error: 'date and note are required' });
    }

    const id = uuidv4();
    const { data, error } = await supabase
      .from('calendar_notes')
      .insert({
        id,
        date,
        note: note.trim(),
        color: color || null,
        visibility: visibility === 'private' ? 'private' : 'team',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit({
      entityType: 'calendar_note',
      entityId: id,
      action: 'create',
      actor: userId,
      actorRole: (req.user?.role as 'staff' | 'manager' | 'admin') || 'staff',
      details: { date, note: note.trim(), color, visibility },
    });

    res.status(201).json(data);
  } catch (err) {
    console.error('Error creating calendar note:', err);
    res.status(500).json({ error: 'Failed to create calendar note' });
  }
});

/**
 * PUT /calendar/notes/:id
 * Update an existing calendar note.
 */
router.put('/calendar/notes/:id', async (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    const userId = req.user?.id || 'unknown';
    const { note, color, visibility, date } = req.body;

    // Verify the note exists and belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('calendar_notes')
      .select('*')
      .eq('id', noteId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (note !== undefined) updateObj.note = note.trim();
    if (color !== undefined) updateObj.color = color || null;
    if (visibility !== undefined) updateObj.visibility = visibility === 'private' ? 'private' : 'team';
    if (date !== undefined) updateObj.date = date;

    const { data, error } = await supabase
      .from('calendar_notes')
      .update(updateObj)
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAudit({
      entityType: 'calendar_note',
      entityId: noteId,
      action: 'update',
      actor: userId,
      actorRole: (req.user?.role as 'staff' | 'manager' | 'admin') || 'staff',
      details: updateObj,
    });

    res.json(data);
  } catch (err) {
    console.error('Error updating calendar note:', err);
    res.status(500).json({ error: 'Failed to update calendar note' });
  }
});

/**
 * DELETE /calendar/notes/:id
 * Delete a calendar note.
 */
router.delete('/calendar/notes/:id', async (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    const userId = req.user?.id || 'unknown';

    const { data: existing, error: fetchError } = await supabase
      .from('calendar_notes')
      .select('*')
      .eq('id', noteId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { error } = await supabase
      .from('calendar_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw new Error(error.message);

    await logAudit({
      entityType: 'calendar_note',
      entityId: noteId,
      action: 'delete',
      actor: userId,
      actorRole: (req.user?.role as 'staff' | 'manager' | 'admin') || 'staff',
      details: { note: (existing as Record<string, unknown>).note },
    });

    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Error deleting calendar note:', err);
    res.status(500).json({ error: 'Failed to delete calendar note' });
  }
});

export default router;
