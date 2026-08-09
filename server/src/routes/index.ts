import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { documentRouter } from './documents.routes.js';
import { categoryRouter } from './categories.routes.js';
import { clientRouter } from './clients.routes.js';
import { accessRouter } from './access.routes.js';
import { activityRouter } from './activity.routes.js';
import { settingsRouter } from './settings.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { chatRouter } from './chat.routes.js';
import { notificationRouter } from './notifications.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/clients', clientRouter);
apiRouter.use('/access', accessRouter);
apiRouter.use('/activity', activityRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/notifications', notificationRouter);