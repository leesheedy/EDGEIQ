import { Router } from 'express';
import eventsRouter from './events';
import analysesRouter from './analyses';
import betsRouter from './bets';
import bankrollRouter from './bankroll';
import settingsRouter from './settings';
import learningRouter from './learning';
import scraperRouter from './scraper';
import screenshotRouter from './screenshot';

const router = Router();

router.use('/events', eventsRouter);
router.use('/analyses', analysesRouter);
router.use('/bets', betsRouter);
router.use('/bankroll', bankrollRouter);
router.use('/settings', settingsRouter);
router.use('/learning', learningRouter);
router.use('/scraper', scraperRouter);
router.use('/screenshot', screenshotRouter);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
