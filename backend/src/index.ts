import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { runMigrations } from './db/migrate';
import { startAgentWorker } from './worker/agent';
import healthRouter from './routes/health';
import contentRouter from './routes/content';
import approvalsRouter from './routes/approvals';
import calendarRouter from './routes/calendar';
import commentsRouter from './routes/comments';
import pluginsRouter from './routes/plugins';
import auditRouter from './routes/audit';
import metaAuthRouter from './routes/meta-auth';
import socialAccountsRouter from './routes/social-accounts';
import socialPostsRouter from './routes/social-posts';
import mediaLibraryRouter from './routes/media-library';
import socialAnalyticsRouter from './routes/social-analytics';
import productsRouter from './routes/products';
import calendarNotesRouter from './routes/calendar-notes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('short'));

app.use('/', healthRouter);

app.use('/api/v1/content-hub', authMiddleware, contentRouter);
app.use('/api/v1/content-hub', authMiddleware, approvalsRouter);
app.use('/api/v1/content-hub', authMiddleware, calendarRouter);
app.use('/api/v1/content-hub', authMiddleware, commentsRouter);
app.use('/api/v1/content-hub', authMiddleware, pluginsRouter);
app.use('/api/v1/content-hub', authMiddleware, auditRouter);
app.use('/api/v1/content-hub', authMiddleware, metaAuthRouter);
app.use('/api/v1/content-hub', authMiddleware, socialAccountsRouter);
app.use('/api/v1/content-hub', authMiddleware, socialPostsRouter);
app.use('/api/v1/content-hub', authMiddleware, mediaLibraryRouter);
app.use('/api/v1/content-hub', authMiddleware, socialAnalyticsRouter);
app.use('/api/v1/content-hub', authMiddleware, calendarNotesRouter);

// Product API routes (Supabase-backed, no auth middleware — public product data)
app.use('/product-api/api/v1', productsRouter);

async function start() {
  console.log('Running migrations...');
  await runMigrations();
  console.log('Migrations complete.');

  startAgentWorker();

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Content Hub v2 API running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
