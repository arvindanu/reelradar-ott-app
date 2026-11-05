import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
type Row = Record<string, any>;

// Keep only verified, manually curated story orders here. Collections themselves
// are discovered dynamically through TMDB's collection search endpoint.
const CHRONOLOGY: Record<number, number[]> = {
  // Star Wars: in-universe order. Unlisted collection titles are appended by release date.
  10: [1893, 1894, 1895, 11, 1891, 1892, 140607, 181808, 181812],
};

async function tmdb(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) {
    throw new Error('TMDB credentials are missing. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to your environment.');
  }

  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== '') url.searchParams.set(name, value);
  }
  if (!token && key) url.searchParams.set('api_key', key);

  const response = await fetch(url, {
    headers: token
      ? { accept: 'application/json', Authorization: `Bearer ${token}` }
      : { accept: 'application/json' },
    next: { revalidate: 21600 },
  });

  if (!response.ok) {
    throw new Error(response.status === 429
      ? 'TMDB is busy. Please try again shortly.'
      : `TMDB request failed (${response.status}).`);
  }
  return response.json() as Promise<Row>;
}

const image = (path?: string | null, size = 'w500') =>
  path ? `${IMG}/${size}${path}` : null;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
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
  id: Number(row.id),
  title: row.title ?? row.original_title ?? 'Untitled',
  overview: row.overview ?? '',
  poster: image(row.poster_path),
  backdrop: image(row.backdrop_path, 'w1280'),
  releaseDate: row.release_date ?? '',
  year: (row.release_date ?? '').slice(0, 4),
  runtime: Number.isFinite(Number(row.runtime)) && Number(row.runtime) > 0
    ? Number(row.runtime) : null,
  rating: typeof row.vote_average === 'number' ? row.vote_average : null,
  language: row.original_language ?? '',
  genres: (row.genres ?? []).map((genre: Row) => Number(genre.id)),
});

const cacheHeaders = {
  'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200',
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;

  try {
    const action = q.get('action') ?? 'search';

    // Discover collections dynamically. No predefined franchise list required.
    if (action === 'search' || action === 'list') {
      const query = (q.get('query') ?? '').trim();
      const page = Math.max(1, Math.min(500, Number(q.get('page') ?? 1) || 1));

      if (query.length < 2) {
        return NextResponse.json({
          results: [],
          totalResults: 0,
          totalPages: 0,
          page,
          message: 'Enter at least two characters to search TMDB collections.',
        }, { headers: cacheHeaders });
      }

      const result = await tmdb('/search/collection', {
        query,
        page: String(page),
        language: q.get('language') ?? 'en-US',
      });

      const results = (Array.isArray(result.results) ? result.results : []).map((item: Row) => ({
        id: Number(item.id),
        name: item.name ?? 'Untitled Collection',
        overview: item.overview ?? '',
        poster: image(item.poster_path),
        backdrop: image(item.backdrop_path, 'w780'),
        hasChronology: Boolean(CHRONOLOGY[Number(item.id)]?.length),
      }));

      return NextResponse.json({
        results,
        page: Number(result.page) || page,
        totalResults: Number(result.total_results) || 0,
        totalPages: Number(result.total_pages) || 0,
      }, { headers: cacheHeaders });
    }

    if (action === 'collection') {
      const id = Number(q.get('id'));
      if (!Number.isSafeInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'A valid TMDB collection ID is required.' }, { status: 400 });
      }

      // Any valid TMDB collection ID is accepted, including dynamically discovered IDs.
      const collection = await tmdb(`/collection/${id}`, { language: 'en-US' });
      const parts: Row[] = Array.isArray(collection.parts) ? collection.parts : [];
      const detailRows = await mapWithConcurrency(parts, 5, async part => {
        try {
          return await tmdb(`/movie/${Number(part.id)}`, { language: 'en-US' });
        } catch {
          return part;
        }
      });

      const releaseOrder = detailRows
        .map(toMovie)
        .sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));

      const chronology = CHRONOLOGY[id];
      const chronologicalOrder = chronology?.length
        ? [
            ...chronology.map(movieId => releaseOrder.find(movie => movie.id === movieId)).filter(Boolean),
            ...releaseOrder.filter(movie => !chronology.includes(movie.id)),
          ]
        : null;

      return NextResponse.json({
        id,
        name: collection.name ?? 'Untitled Collection',
        overview: collection.overview ?? '',
        poster: image(collection.poster_path),
        backdrop: image(collection.backdrop_path, 'w1280'),
        totalMovies: releaseOrder.length,
        movies: releaseOrder,
        chronologicalMovies: chronologicalOrder,
      }, { headers: cacheHeaders });
    }

    return NextResponse.json({ error: 'Unsupported Timeliner action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Could not load Timeliner.',
    }, { status: 500 });
  }
}
