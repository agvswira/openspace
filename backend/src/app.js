import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import projectRoutes from './routes/projects.routes.js';
import roleRoutes from './routes/roles.routes.js';
import meRoutes from './routes/me.routes.js';
import { projectMembersRouter, invitationsRouter, getInvitationInfo } from './routes/members.routes.js';
import { projectTasksRouter, tasksRouter } from './routes/tasks.routes.js';
import { projectPlanningRouter, milestonesRouter, meetingsRouter } from './routes/planning.routes.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Rute publik
  app.use('/api/auth', authRoutes);
  app.get('/api/invitations/:token', getInvitationInfo);

  // Semua rute di bawah ini wajib login (JWT)
  app.use('/api', requireAuth);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId', projectMembersRouter);
  app.use('/api/projects/:projectId', roleRoutes);
  app.use('/api/projects/:projectId', projectPlanningRouter);
  app.use('/api/projects/:projectId/tasks', projectTasksRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/milestones', milestonesRouter);
  app.use('/api/meetings', meetingsRouter);
  app.use('/api', meRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
