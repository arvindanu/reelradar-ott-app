import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
type AnyRecord = Record<string, any>;

async function tmdb(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) throw new Error('TMDB credentials are missing. Add TMDB_ACCESS_TOKEN to .env.local.');
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (key) url.searchParams.set('api_key', key);
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, accept: 'application/json' } : { accept: 'application/json' },
    next: { revalidate: 1800 }
  });
  if (!response.ok) throw new Error(`TMDB request failed (${response.status}).`);
  return response.json();
}

async function enrich(item: AnyRecord, type: 'movie' | 'tv', region: string) {
  try {
    const details = await tmdb(`/${type}/${item.id}`, { append_to_response: 'videos,watch/providers', language: 'en-US' });
    const videos = details.videos?.results ?? [];
    const trailer = videos.find((v: AnyRecord) => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
      ?? videos.find((v: AnyRecord) => v.site === 'YouTube' && v.type === 'Trailer')
      ?? videos.find((v: AnyRecord) => v.site === 'YouTube');
    const providerData = details['watch/providers']?.results?.[region];
    const providers = [...(providerData?.flatrate ?? []), ...(providerData?.rent ?? []), ...(providerData?.buy ?? [])]
      .filter((p: AnyRecord, i: number, arr: AnyRecord[]) => arr.findIndex(x => x.provider_id === p.provider_id) === i)
      .slice(0, 4).map((p: AnyRecord) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ? `${IMG}/w92${p.logo_path}` : null }));
    return {
      id: item.id, mediaType: type, title: item.title ?? item.name ?? 'Untitled',
      overview: item.overview ?? '', poster: item.poster_path ? `${IMG}/w500${item.poster_path}` : null,
      backdrop: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : null,
      releaseDate: item.release_date ?? item.first_air_date ?? '',
      year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
      rating: typeof item.vote_average === 'number' ? Number(item.vote_average.toFixed(1)) : null,
      language: item.original_language ?? '', genres: item.genre_ids ?? details.genres?.map((g: AnyRecord) => g.id) ?? [],
      trailerKey: trailer?.key ?? null,
      trailerThumb: trailer?.key ? `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg` : null,
      providers, watchLink: providerData?.link ?? null
    };
  } catch {
    return {
      id: item.id, mediaType: type, title: item.title ?? item.name ?? 'Untitled', overview: item.overview ?? '',
      poster: item.poster_path ? `${IMG}/w500${item.poster_path}` : null,
      backdrop: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : null,
      releaseDate: item.release_date ?? item.first_air_date ?? '', year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
      rating: typeof item.vote_average === 'number' ? Number(item.vote_average.toFixed(1)) : null,
      language: item.original_language ?? '', genres: item.genre_ids ?? [], trailerKey: null, trailerThumb: null, providers: [], watchLink: null
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'all';
    const language = searchParams.get('language') ?? '';
    const region = searchParams.get('region') ?? 'IN';
    const query = searchParams.get('query') ?? '';
    const page = searchParams.get('page') ?? '1';
    const today = new Date();
    const from = new Date(today); from.setDate(today.getDate() - 120);
    const date = (d: Date) => d.toISOString().slice(0, 10);
    const kinds: ('movie' | 'tv')[] = type === 'movie' ? ['movie'] : type === 'tv' ? ['tv'] : ['movie', 'tv'];
    const requests = await Promise.all(kinds.map(async kind => {
      const params: Record<string, string> = {
        include_adult: 'false', sort_by: kind === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
        page, language: 'en-US', region
      };
      if (language) params.with_original_language = language;
      if (kind === 'movie') { params['primary_release_date.gte'] = date(from); params['primary_release_date.lte'] = date(today); }
      else { params['first_air_date.gte'] = date(from); params['first_air_date.lte'] = date(today); }
      if (type === 'documentary') { params.with_genres = '99'; }
      if (query.trim()) {
        const search = await tmdb(`/search/${kind}`, { query: query.trim(), include_adult: 'false', language: 'en-US', page });
        return (search.results ?? []).filter((x: AnyRecord) => (!language || x.original_language === language) && (type !== 'documentary' || (x.genre_ids ?? []).includes(99))).map((x: AnyRecord) => ({ ...x, _kind: kind }));
      }
      const data = await tmdb(`/discover/${kind}`, params);
      return (data.results ?? []).map((x: AnyRecord) => ({ ...x, _kind: kind }));
    }));
    const raw = requests.flat().sort((a: AnyRecord, b: AnyRecord) => {
      const ad = a.release_date ?? a.first_air_date ?? ''; const bd = b.release_date ?? b.first_air_date ?? '';
      return bd.localeCompare(ad);
    }).slice(0, 18);
    const enriched = await Promise.all(raw.map((item: AnyRecord) => enrich(item, item._kind, region)));
    return NextResponse.json({ results: enriched, page: Number(page), region, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load titles.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
