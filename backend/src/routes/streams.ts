import { Router } from 'express';
import { config } from '../config';

const router = Router();

export interface StreamSource {
  id: string;
  name: string;
  description: string;
  type: 'greyhounds' | 'horses' | 'harness' | 'all';
  states: string[];
  platform: 'youtube' | 'website';
  handle?: string;
  channelId?: string;
  liveUrl: string;
  website: string;
  accent: string;
  free: boolean;
  note?: string;
  liveVideoId?: string;  // populated by YouTube API if available
  isLive?: boolean;
}

const STREAM_SOURCES: StreamSource[] = [
  {
    id: 'grnsw',
    name: 'Dogs TV — NSW',
    description: 'NSW & ACT greyhound racing live',
    type: 'greyhounds',
    states: ['NSW', 'ACT'],
    platform: 'youtube',
    handle: 'greyhoundracingnsw',
    liveUrl: 'https://www.youtube.com/user/greyhoundracingnsw/live',
    website: 'https://www.thedogs.com.au',
    accent: 'blue',
    free: true,
  },
  {
    id: 'grvvision',
    name: 'GRV Vision — VIC',
    description: 'Victorian greyhound racing — main feed',
    type: 'greyhounds',
    states: ['VIC', 'TAS'],
    platform: 'youtube',
    handle: 'GRVvision',
    liveUrl: 'https://www.youtube.com/GRVvision/live',
    website: 'https://watchdog.grv.org.au',
    accent: 'blue',
    free: true,
  },
  {
    id: 'grvextra',
    name: 'GRV Extra — VIC',
    description: 'Victorian greyhound racing — alternate feed',
    type: 'greyhounds',
    states: ['VIC'],
    platform: 'youtube',
    handle: 'GRVextra',
    liveUrl: 'https://www.youtube.com/GRVextra/live',
    website: 'https://watchdog.grv.org.au',
    accent: 'indigo',
    free: true,
  },
  {
    id: 'racingqld',
    name: 'Racing Queensland',
    description: 'QLD horse, harness & greyhound racing',
    type: 'all',
    states: ['QLD'],
    platform: 'youtube',
    handle: 'RACINGQUEENSLAND',
    liveUrl: 'https://www.youtube.com/@RACINGQUEENSLAND/live',
    website: 'https://www.racingqueensland.com.au',
    accent: 'maroon',
    free: true,
  },
  {
    id: 'racingcom',
    name: 'Racing.com',
    description: 'Victorian racing — free live stream',
    type: 'horses',
    states: ['VIC', 'TAS'],
    platform: 'website',
    liveUrl: 'https://www.racing.com/watch-live',
    website: 'https://www.racing.com',
    accent: 'red',
    free: true,
  },
  {
    id: 'watchdog',
    name: 'Watchdog — GRV',
    description: 'VIC greyhound form guide & live vision',
    type: 'greyhounds',
    states: ['VIC'],
    platform: 'website',
    liveUrl: 'https://watchdog.grv.org.au',
    website: 'https://watchdog.grv.org.au',
    accent: 'green',
    free: true,
  },
  {
    id: 'thedogs',
    name: 'The Dogs',
    description: 'Official AU greyhound racing hub',
    type: 'greyhounds',
    states: ['ALL'],
    platform: 'website',
    liveUrl: 'https://www.thedogs.com.au/racing/live-stream',
    website: 'https://www.thedogs.com.au',
    accent: 'orange',
    free: true,
  },
  {
    id: 'skyracing',
    name: 'Sky Racing',
    description: 'All codes — requires TAB/subscription',
    type: 'all',
    states: ['ALL'],
    platform: 'website',
    liveUrl: 'https://www.skyracing.com.au',
    website: 'https://www.skyracing.com.au',
    accent: 'sky',
    free: false,
    note: 'TAB subscribers get free access',
  },
];

// ─── YouTube Data API helper ──────────────────────────────────────────────────

async function findLiveVideoId(handle: string, apiKey: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${handle} live racing`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&eventType=live&type=video&maxResults=3&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = data.items ?? [];
    // Prefer exact channel match if channelTitle matches handle
    const best = items.find(i =>
      i.snippet?.channelTitle?.toLowerCase().includes(handle.toLowerCase()) ||
      i.snippet?.title?.toLowerCase().includes('live')
    ) ?? items[0];
    return best?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  const apiKey = config.youtubeApiKey || undefined;

  if (apiKey) {
    const enriched = await Promise.all(
      STREAM_SOURCES.map(async (s) => {
        if (s.platform !== 'youtube' || !s.handle) return s;
        const videoId = await findLiveVideoId(s.handle, apiKey);
        return { ...s, liveVideoId: videoId ?? undefined, isLive: !!videoId };
      })
    );
    return res.json({ data: enriched });
  }

  res.json({ data: STREAM_SOURCES });
});

export default router;
