import axios from 'axios';
import { db } from '../database';
import type { Event, EnrichedData } from '../types';

// ESPN free API endpoints (public, no key required)
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT_ESPN_MAP: Record<string, string> = {
  nrl: 'rugby-league/nrl',
  afl: 'australian-football/afl',
  nba: 'basketball/nba',
  cricket: 'cricket/icc-cricket',
  tennis: 'tennis/atp',
  soccer: 'soccer/aus.1', // A-League
};

async function fetchEspnTeamForm(
  espnSport: string,
  teamName: string
): Promise<{ form: string[]; record: string }> {
  try {
    const url = `${ESPN_BASE}/${espnSport}/teams`;
    const res = await axios.get(url, { timeout: 8000 });
    const teams = res.data?.sports?.[0]?.leagues?.[0]?.teams || [];

    const team = teams.find((t: { team: { displayName: string; shortDisplayName: string } }) => {
      const n = t.team.displayName?.toLowerCase();
      const s = t.team.shortDisplayName?.toLowerCase();
      const search = teamName.toLowerCase();
      return n?.includes(search) || search.includes(n) || s?.includes(search);
    });

    if (!team) return { form: [], record: 'N/A' };

    const teamId = team.team.id;
    const schedUrl = `${ESPN_BASE}/${espnSport}/teams/${teamId}/schedule`;
    const schedRes = await axios.get(schedUrl, { timeout: 8000 });
    const events = schedRes.data?.events || [];

    const form: string[] = [];
    let wins = 0, losses = 0;

    for (const ev of events.slice(-10)) {
      const comp = ev.competitions?.[0];
      if (!comp?.competitors) continue;
      const myTeam = comp.competitors.find((c: { id: string }) => c.id === teamId);
      if (myTeam) {
        const result = myTeam.winner ? 'W' : 'L';
        form.push(result);
        if (myTeam.winner) wins++;
        else losses++;
      }
    }

    return { form: form.slice(-10), record: `${wins}W-${losses}L` };
  } catch {
    return { form: [], record: 'N/A' };
  }
}

async function fetchH2H(homeTeam: string, awayTeam: string, sport: string): Promise<string> {
  // Use API-Football free tier if available, else return placeholder
  try {
    // Simplified H2H — in production wire up API-Football v3 free tier
    return `Recent H2H: ${homeTeam} vs ${awayTeam} — data from scheduled enrichment`;
  } catch {
    return 'H2H data unavailable';
  }
}

async function enrichSportEvent(event: Event): Promise<void> {
  const espnSport = SPORT_ESPN_MAP[event.sport];
  if (!espnSport) return;

  const homeTeam = event.raw_data.home_team || '';
  const awayTeam = event.raw_data.away_team || '';

  const [homeForm, awayForm, h2h] = await Promise.allSettled([
    fetchEspnTeamForm(espnSport, homeTeam),
    fetchEspnTeamForm(espnSport, awayTeam),
    fetchH2H(homeTeam, awayTeam, event.sport),
  ]);

  const enriched: EnrichedData = {
    form_last_10: [
      ...(homeForm.status === 'fulfilled' ? homeForm.value.form : []),
      '|',
      ...(awayForm.status === 'fulfilled' ? awayForm.value.form : []),
    ],
    h2h_record: h2h.status === 'fulfilled' ? h2h.value : 'N/A',
    home_away_record: [
      `${homeTeam}: ${homeForm.status === 'fulfilled' ? homeForm.value.record : 'N/A'}`,
      `${awayTeam}: ${awayForm.status === 'fulfilled' ? awayForm.value.record : 'N/A'}`,
    ].join(' | '),
    injuries: [],
  };

  await db.upsertEvent({ ...event, enriched_data: enriched });
}

export async function enrichSportsEvents(events: Event[]): Promise<void> {
  const sportEvents = events.filter(
    (e) =>
      !e.sport.startsWith('horse_racing') &&
      e.sport !== 'other'
  );

  for (let i = 0; i < sportEvents.length; i += 3) {
    const batch = sportEvents.slice(i, i + 3);
    await Promise.allSettled(batch.map((e) => enrichSportEvent(e)));
    if (i + 3 < sportEvents.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
