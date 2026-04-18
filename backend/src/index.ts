import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config, validateConfig } from './config';
import routes from './routes/index';
import { startScheduler, stopScheduler } from './services/scheduler';
import { closeBrowser } from './scrapers/tab-scraper';

dotenv.config();

const app = express();

app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in dev
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use('/api', routes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.warn('⚠️  Config warnings:', errors.join(', '));
    console.warn('Some features may not work without proper configuration.');
  }

  const server = app.listen(config.port, () => {
    console.log(`🚀 EdgeIQ backend running on http://localhost:${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Frontend URL: ${config.frontendUrl}`);
  });

  startScheduler();

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down...`);
    stopScheduler();
    await closeBrowser();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
