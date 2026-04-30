/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { config } from '../config';

const router = Router();

export interface RaceInfo {
  venue?: string;
  raceNo?: number;
  raceName?: string;
  distance?: string;
  startTime?: string;
}

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
  liveVideoId?: string;
  isLive?: boolean;
  currentRace?: RaceInfo;
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

// ─── Browser headers (bypass bot detection) ──────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

// ─── YouTube InnerTube API (no key needed) ────────────────────────────────────

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CTX = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'AU',
    userAgent: BROWSER_HEADERS['User-Agent'],
  },
};

/**
 * Uses YouTube's InnerTube API to find the current live stream video ID for a channel.
 * Tries multiple URL patterns for the channel handle.
 */
async function scrapeLiveVideoId(handle: string): Promise<{ videoId: string | null; title: string | null }> {
  // Try several URL patterns YouTube uses
  const urlCandidates = [
    `https://www.youtube.com/@${handle}/live`,
    `https://www.youtube.com/user/${handle}/live`,
    `https://www.youtube.com/c/${handle}/live`,
    `https://www.youtube.com/${handle}/live`,
  ];

  for (const url of urlCandidates) {
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });

      // If redirected to a watch URL, extract video ID from final URL
      const finalUrl = res.url;
      const watchMatch = finalUrl.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (watchMatch) {
        return { videoId: watchMatch[1], title: null };
      }

      if (!res.ok) continue;

      const html = await res.text();

      // Extract video ID from page source (multiple patterns YouTube uses)
      const patterns = [
        /"videoId":"([a-zA-Z0-9_-]{11})"/,
        /watch\?v=([a-zA-Z0-9_-]{11})/,
        /"currentVideoEndpointContinuationData".*?"videoId":"([a-zA-Z0-9_-]{11})"/,
      ];

      let videoId: string | null = null;
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m) { videoId = m[1]; break; }
      }

      // Extract title
      const titleMatch = html.match(/"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/);
      const title = titleMatch?.[1] ?? null;

      // Verify it's actually live (page should contain "isLive":true or similar)
      const isLiveSignal = html.includes('"isLive":true') ||
        html.includes('"status":"OK"') && html.includes('videoId') ||
        finalUrl.includes('/watch?v=');

      if (videoId && isLiveSignal) {
        return { videoId, title };
      }
    } catch {
      continue;
    }
  }

  // Fallback: InnerTube resolve_url
  try {
    const url = `https://www.youtube.com/@${handle}/live`;
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/navigation/resolve_url?key=${INNERTUBE_KEY}`,
      {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20240101.00.00',
        },
        body: JSON.stringify({ context: INNERTUBE_CTX, url }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const json = JSON.stringify(data);
      const m = json.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (m) return { videoId: m[1], title: null };
    }
  } catch {
    // ignore
  }

  return { videoId: null, title: null };
}

// ─── YouTube Data API (optional, uses API key) ───────────────────────────────

async function findLiveVideoIdViaApi(handle: string, apiKey: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${handle} greyhound racing`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&eventType=live&type=video&maxResults=5&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = data.items ?? [];
    const best = items.find(i =>
      i.snippet?.channelTitle?.toLowerCase().includes(handle.toLowerCase())
    ) ?? items[0];
    return best?.id?.videoId ?? null;
  } catch {
    return null;
  }
}

// ─── thedogs.com.au race info scraper ────────────────────────────────────────

async function scrapeDogsRaceInfo(): Promise<RaceInfo | null> {
  // Try their API endpoints first
  const apiUrls = [
    'https://www.thedogs.com.au/api/racing/live',
    'https://api.thedogs.com.au/racing/live',
    'https://www.thedogs.com.au/api/v1/meetings/live',
  ];

  for (const apiUrl of apiUrls) {
    try {
      const res = await fetch(apiUrl, {
        headers: { ...BROWSER_HEADERS, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        // Try to extract race info from various API response shapes
        const meeting = data?.meetings?.[0] ?? data?.data?.[0] ?? data?.[0];
        if (meeting) {
          return {
            venue: meeting.venueName ?? meeting.venue ?? meeting.track,
            raceNo: meeting.raceNo ?? meeting.race_number ?? meeting.currentRace,
            raceName: meeting.raceName ?? meeting.name,
            distance: meeting.distance ? `${meeting.distance}m` : undefined,
            startTime: meeting.startTime ?? meeting.start_time,
          };
        }
      }
    } catch { continue; }
  }

  // Fallback: scrape the page
  try {
    const res = await fetch('https://www.thedogs.com.au/racing/results', {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract venue from common patterns
    const venueMatch = html.match(/class="[^"]*venue[^"]*"[^>]*>([^<]+)</) ??
      html.match(/"venueName"\s*:\s*"([^"]+)"/);
    const raceMatch = html.match(/[Rr]ace\s*(\d+)/);

    if (venueMatch || raceMatch) {
      return {
        venue: venueMatch?.[1]?.trim(),
        raceNo: raceMatch ? parseInt(raceMatch[1]) : undefined,
      };
    }
  } catch { /* ignore */ }

  return null;
}

// ─── Simple in-memory cache (5 min TTL) ──────────────────────────────────────

let cache: { data: StreamSource[]; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ─── Route ───────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  // Serve from cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return res.json({ data: cache.data, cached: true });
  }

  const apiKey = config.youtubeApiKey || undefined;

  // Enrich all YouTube sources in parallel
  const enriched = await Promise.all(
    STREAM_SOURCES.map(async (s): Promise<StreamSource> => {
      if (s.platform !== 'youtube' || !s.handle) return s;

      let videoId: string | null = null;
      let title: string | null = null;

      if (apiKey) {
        videoId = await findLiveVideoIdViaApi(s.handle, apiKey);
      } else {
        const result = await scrapeLiveVideoId(s.handle);
        videoId = result.videoId;
        title = result.title;
      }

      // For GRNSW, also try to get race info from thedogs.com.au
      let currentRace: RaceInfo | undefined;
      if (s.id === 'grnsw' && videoId) {
        const raceInfo = await scrapeDogsRaceInfo();
        if (raceInfo) currentRace = raceInfo;
      }

      // If we got a video ID, also try to get title from YouTube page title
      const desc = title
        ? title.replace(/\s*-\s*YouTube$/, '').trim()
        : s.description;

      return {
        ...s,
        description: desc,
        liveVideoId: videoId ?? undefined,
        isLive: !!videoId,
        currentRace,
      };
    })
  );

  cache = { data: enriched, ts: Date.now() };
  return res.json({ data: enriched, cached: false });
});

// Force-refresh endpoint
router.post('/refresh', async (_req, res) => {
  cache = null;
  res.json({ ok: true });
});

export default router;
