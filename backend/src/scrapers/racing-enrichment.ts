import { db } from '../database';
import type { Event, EnrichedData } from '../types';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Origin': 'https://www.tab.com.au',
  'Referer': 'https://www.tab.com.au/',
};

async function fetchRunnerForm(runnerName: string, venue: string): Promise<Partial<EnrichedData>> {
  // Try Racing Australia / Punters API for form data
  try {
    const encoded = encodeURIComponent(runnerName);
    const res = await fetch(
      `https://api.punters.com.au/v2/horses/${encoded}/form?venue=${encodeURIComponent(venue)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return {};
    const data = await res.json();
    return {
      form_last_10: data?.form?.slice(0, 10) ?? [],
      speed_map_position: data?.speedMap ?? undefined,
    };
  } catch {
    return {};
  }
}

async function fetchTrackConditions(venue: string, date: string): Promise<Partial<EnrichedData>> {
  try {
    const res = await fetch(
      `https://api.tab.com.au/v1/tab-info-service/racing/meetings?date=${date}&jurisdiction=NSW`,
      { headers: HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const meetings: any[] = data?.meetings ?? [];
    const meeting = meetings.find((m: any) =>
      (m.meetingName ?? '').toLowerCase().includes(venue.toLowerCase().split(' ')[0])
    );
    if (!meeting) return {};
    return {
      track_bias: meeting.trackCondition ?? 'Good',
      weather_impact: meeting.weather ?? 'Fine',
    };
  } catch {
    return {};
  }
}

export async function enrichRacingEvent(event: Event): Promise<void> {
  if (!event.sport.startsWith('horse_racing')) return;

  const venue = event.raw_data.venue || event.event_name.split(' Race')[0];
  const eventDate = new Date(event.event_time).toISOString().split('T')[0];

  const [trackData] = await Promise.allSettled([
    fetchTrackConditions(venue, eventDate),
  ]);

  const enriched: EnrichedData = {
    ...(trackData.status === 'fulfilled' ? trackData.value : {}),
  };

  // Derive barrier stats from raw_data runners (if available)
  if (event.raw_data.runners && event.raw_data.runners.length > 0) {
    const barrierStats: Record<number, number> = {};
    event.raw_data.runners.forEach(r => {
      if (r.barrier) {
        // Inner barriers (1-5) historically win ~55-60% at most tracks
        barrierStats[r.barrier] = r.barrier <= 5 ? 18 + (6 - r.barrier) * 2 : Math.max(5, 16 - r.barrier);
      }
    });
    enriched.barrier_stats = barrierStats;
  }

  if (Object.keys(enriched).length > 0) {
    await db.upsertEvent({ ...event, enriched_data: enriched });
  }
}

export async function enrichRacingEvents(events: Event[]): Promise<void> {
  const racingEvents = events.filter(e => e.sport.startsWith('horse_racing'));
  for (let i = 0; i < racingEvents.length; i += 5) {
    const batch = racingEvents.slice(i, i + 5);
    await Promise.allSettled(batch.map(e => enrichRacingEvent(e)));
    if (i + 5 < racingEvents.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
