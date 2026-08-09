import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../libs/supabase.js';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';

export const categoryRouter = Router();

const createSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(500).trim().optional().or(z.literal(''))
});

categoryRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ categories: data ?? [] });
  })
);

categoryRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const body = createSchema.parse(req.body ?? {});
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: body.name, description: body.description || null })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') throw AppError.conflict('A category with this name already exists.');
      throw error;
    }
    res.status(201).json({ category: data });
  })
);

categoryRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const body = createSchema.partial().parse(req.body ?? {});
    const { data, error } = await supabase
      .from('categories')
      .update({ name: body.name, description: body.description })
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') throw AppError.conflict('A category with this name already exists.');
      throw error;
    }
    res.json({ category: data });
  })
);

categoryRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', req.params.id);
    if ((count ?? 0) > 0) {
      throw AppError.conflict('This category still has documents. Move or delete them first.');
    }
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Category deleted.' });
  })
);