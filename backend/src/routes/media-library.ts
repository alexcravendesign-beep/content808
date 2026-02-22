import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

router.get('/social/media', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { file_type, limit: limitParam, offset: offsetParam } = req.query;

    const pageLimit = Math.min(parseInt(limitParam as string) || 50, 200);
    const pageOffset = parseInt(offsetParam as string) || 0;

    let mediaQuery = supabase
      .from('media_library')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    if (file_type) {
      mediaQuery = mediaQuery.eq('file_type', String(file_type));
    }

    const { data, count, error } = await mediaQuery;
    if (error) throw new Error(error.message);

    res.json({
      media: data || [],
      total: count ?? 0,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.post('/social/media/upload-url', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { file_name, file_type, file_size, mime_type } = req.body;

    if (!file_name || !file_type) {
      return res.status(400).json({ error: 'file_name and file_type are required' });
    }

    const mediaId = uuidv4();
    const ext = path.extname(file_name) || `.${file_type.split('/').pop()}`;
    const storageKey = `media/${userId}/${mediaId}${ext}`;
    const uploadUrl = `${config.storage.baseUrl}/${storageKey}`;

    const { error: insertError } = await supabase.from('media_library').insert({
      id: mediaId,
      user_id: userId,
      file_name,
      file_type,
      file_size: file_size || 0,
      mime_type: mime_type || '',
      url: uploadUrl,
      storage_key: storageKey,
    });
    if (insertError) throw new Error(insertError.message);

    const uploadDir = path.join(config.storage.uploadDir, 'media', userId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    res.json({
      id: mediaId,
      upload_url: uploadUrl,
      storage_key: storageKey,
      local_path: path.join(uploadDir, `${mediaId}${ext}`),
    });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

router.post('/social/media/confirm-upload', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { media_id, url, thumbnail_url, width, height, duration_seconds } = req.body;

    if (!media_id) {
      return res.status(400).json({ error: 'media_id is required' });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', media_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const updateObj: Record<string, unknown> = {};
    if (url) updateObj.url = url;
    if (thumbnail_url) updateObj.thumbnail_url = thumbnail_url;
    if (width) updateObj.width = width;
    if (height) updateObj.height = height;
    if (duration_seconds) updateObj.duration_seconds = duration_seconds;

    if (Object.keys(updateObj).length > 0) {
      const { error: updateError } = await supabase
        .from('media_library')
        .update(updateObj)
        .eq('id', media_id);
      if (updateError) throw new Error(updateError.message);
    }

    const { data } = await supabase.from('media_library').select('*').eq('id', media_id).single();
    res.json(data);
  } catch (err) {
    console.error('Error confirming upload:', err);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

router.delete('/social/media/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('media_library')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const { data: inUseData, error: inUseError } = await supabase
      .from('social_post_media')
      .select('id', { count: 'exact' })
      .eq('media_id', req.params.id);
    if (inUseError) throw new Error(inUseError.message);

    if (inUseData && inUseData.length > 0) {
      return res.status(400).json({ error: 'Media is in use by one or more posts. Remove from posts first.' });
    }

    const { error: deleteError } = await supabase.from('media_library').delete().eq('id', req.params.id);
    if (deleteError) throw new Error(deleteError.message);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
