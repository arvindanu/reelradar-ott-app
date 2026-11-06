import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TMDB = 'https://api.themoviedb.org/3';
const IMAGE = 'https://image.tmdb.org/t/p';
const recentRequests = new Map<string, number>();
type Obj = Record<string, any>;
type Answers = {
  mood: string;
  outcome: string;
  format: string;
  company: string;
  vibe: string;
  language?: string;
  region?: string;
};
type Candidate = {
  id: number; mediaType: 'movie' | 'tv'; title: string; overview: string;
  poster: string | null; backdrop: string | null; releaseDate: string; year: string;
  rating: number | null; voteCount: number; language: string; genres: number[];
  runtime: number | null; providers: { id: number; name: string; logo: string | null }[];
  watchLink: string | null; trailerKey: string | null; score: number;
  reasons: string[];
};

const GENRES: Record<string, number[]> = {
  action: [28, 12, 878], adventure: [12, 14, 28], comedy: [35, 10751], crime: [80, 9648, 53],
  drama: [18, 10749], fantasy: [14, 12, 16], horror: [27, 53, 9648], mystery: [9648, 80, 53],
  romance: [10749, 18, 35], scifi: [878, 12, 9648], thriller: [53, 80, 9648], animation: [16, 10751, 14],
  feelgood: [35, 10751, 10749], emotional: [18, 10749], mindbending: [878, 9648, 53], inspiring: [18, 10751, 36],
  relaxing: [35, 10751, 16], intense: [28, 53, 80], cozy: [35, 10749, 10751], dark: [27, 80, 53],
};
const MOOD_GENRES: Record<string, number[]> = {
  happy: [35, 10751, 16], sad: [18, 10749], stressed: [35, 16, 10751], curious: [9648, 878, 12],
  adventurous: [12, 28, 14], scared: [27, 53, 9648], romantic: [10749, 18, 35], bored: [28, 35, 878],
};
const OUTCOME_GENRES: Record<string, number[]> = {
  laugh: [35, 10751], escape: [14, 878, 12], think: [9648, 878, 18], cry: [18, 10749],
  adrenaline: [28, 53, 80], comfort: [35, 10751, 16], surprise: [9648, 53, 878],
};
const VIBE_GENRES: Record<string, number[]> = {
  light: [35, 10751, 16], dark: [27, 80, 53], epic: [12, 14, 28], clever: [9648, 878, 80],
  heartfelt: [18, 10749, 10751], weird: [878, 14, 9648], grounded: [18, 80, 36],
};
const unique = <T,>(xs: T[]) => [...new Set(xs)];
const img = (path?: string | null, size = 'w500') => path ? `${IMAGE}/${size}${path}` : null;

async function tmdb(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) throw new Error('TMDB credentials are missing. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to your environment.');
  const url = new URL(`${TMDB}${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== '') url.searchParams.set(k, v); });
  if (!token && key) url.searchParams.set('api_key', key);
  const response = await fetch(url, {
    headers: token ? { accept: 'application/json', Authorization: `Bearer ${token}` } : { accept: 'application/json' },
    next: { revalidate: 900 },
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('TMDB is receiving too many requests. Please try again in a moment.');
    throw new Error(`TMDB request failed (${response.status}).`);
  }
  return response.json() as Promise<Obj>;
}

function normalize(row: Obj, mediaType: 'movie' | 'tv'): Candidate {
  const releaseDate = mediaType === 'movie' ? row.release_date ?? '' : row.first_air_date ?? '';
  return {
    id: Number(row.id), mediaType,
    title: String(mediaType === 'movie' ? row.title ?? '' : row.name ?? ''),
    overview: String(row.overview ?? ''), poster: img(row.poster_path), backdrop: img(row.backdrop_path, 'w780'),
    releaseDate, year: releaseDate ? releaseDate.slice(0, 4) : '',
    rating: Number.isFinite(Number(row.vote_average)) ? Number(row.vote_average) : null,
    voteCount: Number(row.vote_count) || 0, language: String(row.original_language ?? ''),
    genres: Array.isArray(row.genre_ids) ? row.genre_ids.map(Number) : [],
    runtime: null, providers: [], watchLink: null, trailerKey: null, score: 0, reasons: [],
  };
}

function scoreCandidate(
  item: Candidate,
  answers: Answers,
  preferredGenres: number[],
  excluded: Set<string>
): { score: number; reasons: string[] } {
  if (excluded.has(`${item.mediaType}:${item.id}`)) {
    return { score: -1000, reasons: [] };
  }
  const genres = new Set(item.genres);
  let score = 0;
  const overlap = preferredGenres.filter(id => genres.has(id));
  score += overlap.length * 9;
  if (MOOD_GENRES[answers.mood]) score += MOOD_GENRES[answers.mood].some(id => genres.has(id)) ? 16 : 0;
  if (OUTCOME_GENRES[answers.outcome]) score += OUTCOME_GENRES[answers.outcome].some(id => genres.has(id)) ? 18 : 0;
  if (VIBE_GENRES[answers.vibe]) score += VIBE_GENRES[answers.vibe].some(id => genres.has(id)) ? 13 : 0;
  if (answers.language && answers.language !== 'any') score += item.language === answers.language ? 15 : -18;
  score += Math.min(10, item.rating ?? 0);
  if (item.voteCount > 1000) score += 5;
  if (item.voteCount < 80) score -= 8;
  if (answers.company === 'family') score += genres.has(10751) ? 24 : genres.has(27) || genres.has(80) ? -35 : -5;
  if (answers.company === 'date') score += genres.has(10749) || genres.has(35) || genres.has(18) ? 8 : 0;
  if (answers.company === 'friends') score += genres.has(28) || genres.has(35) || genres.has(27) ? 7 : 0;
  if (answers.company === 'solo') score += genres.has(9648) || genres.has(878) || genres.has(18) ? 7 : 0;
  const reasons: string[] = [];
  if (MOOD_GENRES[answers.mood]?.some(id => genres.has(id))) reasons.push('fits the mood you selected');
  if (OUTCOME_GENRES[answers.outcome]?.some(id => genres.has(id))) reasons.push('matches the feeling you want');
  if (VIBE_GENRES[answers.vibe]?.some(id => genres.has(id))) reasons.push('matches your preferred vibe');
  if (answers.language && answers.language !== 'any' && item.language === answers.language) reasons.push('in your chosen language');
  if (answers.company === 'family' && genres.has(10751)) reasons.push('family-friendly genre match');
  if (!reasons.length) reasons.push('a strong overall match from your answers');
  return { score, reasons: unique(reasons).slice(0, 3) };
}

async function enrich(item: Candidate, region: string): Promise<Candidate> {
  const type = item.mediaType;
  const [details, videos, providers] = await Promise.all([
    tmdb(`/${type}/${item.id}`, { language: 'en-US' }).catch(() => ({} as Obj)),
    tmdb(`/${type}/${item.id}/videos`, { language: 'en-US' }).catch(() => ({} as Obj)),
    tmdb(`/${type}/${item.id}/watch/providers`).catch(() => ({} as Obj)),
  ]);
  const trailer = (videos.results ?? []).find((v: Obj) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
    (videos.results ?? []).find((v: Obj) => v.site === 'YouTube' && v.type === 'Trailer');
  const regionData = providers.results?.[region] ?? providers.results?.US ?? {};
  const providerRows = [...(regionData.flatrate ?? []), ...(regionData.rent ?? []), ...(regionData.buy ?? [])];
  const providerMap = new Map<number, { id: number; name: string; logo: string | null }>();
  for (const p of providerRows) providerMap.set(Number(p.provider_id), { id: Number(p.provider_id), name: String(p.provider_name), logo: img(p.logo_path, 'w92') });
  return {
    ...item,
    runtime: type === 'movie' ? Number(details.runtime) || null : null,
    providers: [...providerMap.values()].slice(0, 6),
    watchLink: typeof regionData.link === 'string' ? regionData.link : null,
    trailerKey: typeof trailer?.key === 'string' ? trailer.key : null,
  };
}

export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const now = Date.now();
  const previous = recentRequests.get(ip) ?? 0;
  if (now - previous < 1200) return NextResponse.json({ error: 'Please wait a moment before requesting another match.' }, { status: 429 });
  recentRequests.set(ip, now);
  if (recentRequests.size > 1000) {
    for (const [key, time] of recentRequests) if (now - time > 60_000) recentRequests.delete(key);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const answers = (body.answers ?? {}) as Answers;
    const region = /^[A-Z]{2}$/.test(String(answers.region ?? 'IN').toUpperCase()) ? String(answers.region ?? 'IN').toUpperCase() : 'IN';
    const excluded = new Set<string>(Array.isArray(body.exclude) ? body.exclude.map((x: unknown) => String(x)) : []);
    const mood = answers.mood || 'happy';
    const outcome = answers.outcome || 'laugh';
    const vibe = answers.vibe || 'light';
    const preferredGenres = unique([...(MOOD_GENRES[mood] ?? []), ...(OUTCOME_GENRES[outcome] ?? []), ...(VIBE_GENRES[vibe] ?? [])]);
    const format = answers.format || 'feature';
    const company = answers.company || 'solo';
    const language = answers.language && answers.language !== 'any' ? answers.language : '';
    const requestedMedia: Array<'movie' | 'tv'> = format === 'series' ? ['tv'] : format === 'movie' || format === 'short' || format === 'feature' ? ['movie'] : ['movie', 'tv'];
    const genres = preferredGenres.slice(0, 5).join('|');
    const minRuntime = format === 'short' ? 1 : format === 'feature' ? 75 : 0;
    const maxRuntime = format === 'short' ? 90 : format === 'feature' ? 145 : 0;
    const family = company === 'family';
    const requests: Promise<Obj>[] = [];
    for (const type of requestedMedia) {
      const common: Record<string, string> = {
        include_adult: 'false', include_video: 'false', language: 'en-US', sort_by: 'popularity.desc',
        'vote_count.gte': family ? '40' : '80', 'vote_average.gte': family ? '5.7' : '6.0', page: '1',
      };
      if (genres) common.with_genres = genres;
      if (language) common.with_original_language = language;
      if (type === 'movie') {
        if (minRuntime) common['with_runtime.gte'] = String(minRuntime);
        if (maxRuntime) common['with_runtime.lte'] = String(maxRuntime);
        if (family) { common.certification_country = 'US'; common['certification.lte'] = 'PG'; }
        requests.push(tmdb('/discover/movie', common));
        const alt = { ...common, sort_by: 'vote_average.desc', page: '2', 'vote_count.gte': family ? '25' : '50' };
        requests.push(tmdb('/discover/movie', alt));
      } else {
        if (family) common.with_genres = '16|35|10762';
        requests.push(tmdb('/discover/tv', common));
        requests.push(tmdb('/discover/tv', { ...common, sort_by: 'vote_average.desc', page: '2' }));
      }
    }
    const responses = await Promise.all(requests);
    const allRows = responses.flatMap((r, index) => (r.results ?? []).map((row: Obj) => normalize(row, requestedMedia[Math.floor(index / 2)])));
    const deduped = [...new Map(allRows.map(item => [`${item.mediaType}:${item.id}`, item] as const)).values()];
    let ranked = deduped.map(item => ({ item, ...scoreCandidate(item, answers, preferredGenres, excluded) }))
      .filter(x => x.score > -100)
      .sort((a, b) => b.score - a.score);

    // Broaden the pool if strict filters (especially language + runtime) return too few results.
    if (ranked.length < 5) {
      const fallbackRequests: Promise<Obj>[] = [];
      for (const type of requestedMedia) {
        const relaxed: Record<string, string> = { include_adult: 'false', language: 'en-US', sort_by: 'popularity.desc', 'vote_count.gte': '25', 'vote_average.gte': '5.5', page: '3' };
        if (preferredGenres.length) relaxed.with_genres = preferredGenres.slice(0, 3).join('|');
        if (type === 'movie') {
          if (format === 'short') relaxed['with_runtime.lte'] = '100';
          if (family) { relaxed.certification_country = 'US'; relaxed['certification.lte'] = 'PG'; }
          fallbackRequests.push(tmdb('/discover/movie', relaxed));
        } else fallbackRequests.push(tmdb('/discover/tv', relaxed));
      }
      const fallbackRows = (await Promise.all(fallbackRequests)).flatMap((r, index) => (r.results ?? []).map((row: Obj) => normalize(row, requestedMedia[index])));
      const merged = [...new Map([...deduped, ...fallbackRows].map(item => [`${item.mediaType}:${item.id}`, item] as const)).values()];
      ranked = merged.map(item => ({ item, ...scoreCandidate(item, answers, preferredGenres, excluded) }))
        .filter(x => x.score > -100).sort((a, b) => b.score - a.score);
    }
    // Shuffle within a narrow score band to keep recommendations from repeating in the same order.
    const topBand = ranked.slice(0, 18).sort(() => Math.random() - 0.5);
    const selected = [...topBand, ...ranked.slice(18)].slice(0, 12);
    if (!selected.length) return NextResponse.json({ error: 'No titles matched those answers. Try a different language or format.' }, { status: 404 });
    const enriched = await Promise.all(selected.slice(0, 5).map(async x => {
      const full = await enrich(x.item, region);
      return { ...full, score: x.score, reasons: x.reasons };
    }));
    const primaryFull = enriched[0];
    const runnersUp = enriched.slice(1, 5);
    return NextResponse.json({
      match: primaryFull, runnersUp,
      matchPercent: Math.max(78, Math.min(99, Math.round(80 + primaryFull.score / 5))),
      totalCandidates: ranked.length,
      note: 'Recommendations are matched from your answers using TMDB genre, format, language, rating and popularity data.',
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not find a VibeFlix match.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
