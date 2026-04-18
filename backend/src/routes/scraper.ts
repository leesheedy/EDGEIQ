import { Router } from 'express';
import { getStatus, triggerManualScrape } from '../services/scheduler';
import { getScraperErrors } from '../scrapers/tab-scraper';

const router = Router();

router.get('/status', (_req, res) => {
  const status = getStatus();
  res.json({ data: status });
});

router.post('/trigger', async (_req, res) => {
  const status = await triggerManualScrape();
  res.json({ data: status, message: 'Scrape triggered' });
});

router.get('/errors', (_req, res) => {
  const errors = getScraperErrors();
  res.json({ data: errors });
});

export default router;
