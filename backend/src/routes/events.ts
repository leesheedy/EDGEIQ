import { Router } from 'express';
import { db } from '../database';

const router = Router();

router.get('/', async (req, res) => {
  const { sport, limit } = req.query;
  const events = await db.getEvents({
    sport: sport as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 100,
  });
  res.json({ data: events });
});

router.get('/:id', async (req, res) => {
  const event = await db.getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ data: event });
});

export default router;
