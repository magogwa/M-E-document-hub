import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../libs/errors.js';
import { requireAuth, type AuthRequest } from '../middlewares/auth.js';
import { getSettings, updateSettings } from '../services/settings.service.js';
import { logActivity, ACTIVITY_ACTIONS } from '../services/activity.service.js';

export const settingsRouter = Router();

const updateSchema = z.object({
  appName: z.string().min(1).max(80).optional(),
  allowClientUpload: z.boolean().optional(),
  allowClientRegistration: z.boolean().optional(),
  maxFileSizeMB: z.number().int().min(1).max(200).optional(),
  emailNotifications: z.boolean().optional(),
  storageLimitMB: z.number().int().min(0).max(1000000).optional()
});

/** GET /api/settings - full settings for admins; minimal public subset otherwise */
settingsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const settings = await getSettings();
    if (req.user?.role === 'admin') {
      return res.json({ settings });
    }
    res.json({
      settings: {
        appName: settings.appName,
        allowClientUpload: settings.allowClientUpload,
        maxFileSizeMB: settings.maxFileSizeMB
      }
    });
  })
);

/** PUT /api/settings - admin only */
settingsRouter.put(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.user?.role !== 'admin') throw AppError.forbidden('Access denied.');
    const body = updateSchema.parse(req.body ?? {});
    const settings = await updateSettings(body);
    await logActivity({
      userId: req.user.id,
      action: ACTIVITY_ACTIONS.SETTINGS_UPDATED,
      metadata: { keys: Object.keys(body) }
    });
    res.json({ success: true, settings });
  })
);