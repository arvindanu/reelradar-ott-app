import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
type Row = Record<string, any>;
type Franchise = { id: number; name: string; chronology?: number[] };

// TMDB collection IDs are stable IDs copied from TMDB collection records.
// Add or correct franchises here; chronological arrays contain TMDB movie IDs.
const FRANCHISES: Franchise[] = [
  { id: 10, name: 'Star Wars', chronology: [1893, 1894, 1895, 11, 1891, 1892, 140607, 181808, 181812] },
  { id: 1241, name: 'Harry Potter' },
  { id: 119, name: 'The Lord of the Rings' },
  { id: 121938, name: 'The Hobbit' },
  { id: 9485, name: 'Fast & Furious' },
  { id: 328, name: 'Jurassic Park' },
  { id: 10194, name: 'Toy Story' },
  { id: 295, name: 'Pirates of the Caribbean' },
  { id: 84, name: 'Indiana Jones' },
  { id: 87359, name: 'Mission: Impossible' },
  { id: 556, name: 'Spider-Man' },
  { id: 948, name: 'Batman' },
  { id: 645, name: 'James Bond' },
  { id: 2150, name: 'Shrek' },
  { id: 131635, name: 'The Hunger Games' },
  { id: 8650, name: 'Transformers' },
  { id: 2344, name: 'The Matrix' },
  { id: 89137, name: 'How to Train Your Dragon' },
  { id: 77816, name: 'Kung Fu Panda' },
];

async function tmdb(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) throw new Error('TMDB credentials are missing. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to your environment.');
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) if (value !== '') url.searchParams.set(name, value);
  if (!token && key) url.searchParams.set('api_key', key);
  const response = await fetch(url, {
    headers: token ? { accept: 'application/json', Authorization: `Bearer ${token}` } : { accept: 'application/json' },
    next: { revalidate: 21600 },
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'TMDB is busy. Please try again shortly.' : `TMDB request failed (${response.status}).`);
  return response.json() as Promise<Row>;
}
const image = (path?: string | null, size = 'w500') => path ? `${IMG}/${size}${path}` : null;
async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
const toMovie = (row: Row) => ({
  id: Number(row.id), title: row.title ?? row.original_title ?? 'Untitled', overview: row.overview ?? '',
  poster: image(row.poster_path), backdrop: image(row.backdrop_path, 'w1280'),
  releaseDate: row.release_date ?? '', year: (row.release_date ?? '').slice(0, 4),
  runtime: Number.isFinite(Number(row.runtime)) && Number(row.runtime) > 0 ? Number(row.runtime) : null,
  rating: typeof row.vote_average === 'number' ? row.vote_average : null,
  language: row.original_language ?? '', genres: (row.genres ?? []).map((g: Row) => Number(g.id)),
});

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  try {
    if ((q.get('action') ?? 'list') === 'collection') {
      const id = Number(q.get('id'));
      const franchise = FRANCHISES.find(item => item.id === id);
      if (!franchise) return NextResponse.json({ error: 'That franchise is not in the Timeliner catalogue.' }, { status: 404 });
      const collection = await tmdb(`/collection/${id}`, { language: 'en-US' });
      const parts: Row[] = Array.isArray(collection.parts) ? collection.parts : [];
      const detailRows = await mapWithConcurrency(parts, 5, async part => {
        try { return await tmdb(`/movie/${Number(part.id)}`, { language: 'en-US' }); }
        catch { return part; }
      });
      const releaseOrder = detailRows.map(toMovie).sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));
      const chronology = franchise.chronology?.length ? franchise.chronology : null;
      const chronologicalOrder = chronology ? [
        ...chronology.map(id => releaseOrder.find(movie => movie.id === id)).filter(Boolean),
        ...releaseOrder.filter(movie => !chronology.includes(movie.id)),
      ] : null;
      return NextResponse.json({
        id, name: collection.name ?? franchise.name, overview: collection.overview ?? '',
        poster: image(collection.poster_path), backdrop: image(collection.backdrop_path, 'w1280'),
        totalMovies: releaseOrder.length, movies: releaseOrder, chronologicalMovies: chronologicalOrder,
      }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } });
    }

    const collections = await Promise.all(FRANCHISES.map(async franchise => {
      try {
        const data = await tmdb(`/collection/${franchise.id}`, { language: 'en-US' });
        const movies: Row[] = Array.isArray(data.parts) ? data.parts : [];
        const languages = [...new Set(movies.map(movie => String(movie.original_language ?? '')).filter(Boolean))];
        const genres = [...new Set(movies.flatMap(movie => (movie.genre_ids ?? []).map(Number)))];
        const dates = movies.map(movie => String(movie.release_date ?? '')).filter(Boolean).sort();
        return { id: franchise.id, name: data.name ?? franchise.name, poster: image(data.poster_path), backdrop: image(data.backdrop_path, 'w780'), movieCount: movies.length, languages, genres, newestRelease: dates.at(-1) ?? '', hasChronology: Boolean(franchise.chronology?.length) };
      } catch { return null; }
    }));
    return NextResponse.json({ franchises: collections.filter(Boolean) }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load Timeliner.' }, { status: 500 });
  }
}
