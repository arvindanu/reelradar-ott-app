import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
type AnyRecord = Record<string, any>;
type MovieProfile = {
  id: number; title: string; overview: string; poster: string | null; backdrop: string | null;
  releaseDate: string; year: string; rating: number | null; language: string; genres: number[];
  genreNames: string[]; keywords: string[]; cast: string[]; director: string[]; runtime: number | null;
  recommendations: number[]; similar: number[];
};

async function tmdb(path: string, params: Record<string, string> = {}) {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) throw new Error('TMDB credentials are missing.');
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([name, value]) => { if (value) url.searchParams.set(name, value); });
  if (!token && key) url.searchParams.set('api_key', key);
  const response = await fetch(url, {
    headers: token ? { accept: 'application/json', Authorization: `Bearer ${token}` } : { accept: 'application/json' },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(response.status === 429 ? 'TMDB rate limit reached. Try again shortly.' : `TMDB request failed (${response.status}).`);
  return response.json() as Promise<AnyRecord>;
}

const image = (path?: string | null, size = 'w500') => path ? `${IMG}/${size}${path}` : null;
const unique = <T,>(values: T[]) => [...new Set(values)];
const overlap = (a: string[], b: string[]) => a.filter(x => b.includes(x));
const GENRE_NAMES: Record<number, string> = { 28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Science Fiction',10770:'TV Movie',53:'Thriller',10752:'War',37:'Western' };
const norm = (s: string) => s.toLowerCase().trim();

async function getProfile(id: number): Promise<MovieProfile> {
  const d = await tmdb(`/movie/${id}`, { append_to_response: 'keywords,credits,recommendations,similar' });
  const releaseDate = d.release_date ?? '';
  const keywordRows = d.keywords?.keywords ?? [];
  const castRows = d.credits?.cast ?? [];
  const crewRows = d.credits?.crew ?? [];
  const directors = crewRows.filter((x: AnyRecord) => x.job === 'Director').map((x: AnyRecord) => x.name);
  return {
    id: d.id, title: d.title ?? d.original_title ?? 'Untitled', overview: d.overview ?? '',
    poster: image(d.poster_path), backdrop: image(d.backdrop_path, 'w780'), releaseDate,
    year: releaseDate ? releaseDate.slice(0, 4) : '', rating: typeof d.vote_average === 'number' ? d.vote_average : null,
    language: d.original_language ?? '', genres: (d.genres ?? []).map((x: AnyRecord) => x.id),
    genreNames: (d.genres ?? []).map((x: AnyRecord) => x.name), keywords: keywordRows.map((x: AnyRecord) => norm(x.name)),
    cast: castRows.slice(0, 15).map((x: AnyRecord) => norm(x.name)), director: directors.map(norm),
    runtime: d.runtime ?? null,
    recommendations: (d.recommendations?.results ?? []).map((x: AnyRecord) => x.id),
    similar: (d.similar?.results ?? []).map((x: AnyRecord) => x.id),
  };
}

function scoreCandidate(candidate: AnyRecord, a: MovieProfile, b: MovieProfile) {
  const genres = (candidate.genre_ids ?? candidate.genres?.map((x: AnyRecord) => x.id) ?? []).map(Number);
  const year = Number((candidate.release_date ?? '').slice(0, 4));
  const genreA = overlap(genres.map(String), a.genres.map(String));
  const genreB = overlap(genres.map(String), b.genres.map(String));
  const keywordNames: string[] = candidate.__keywords ?? [];
  const keywordA = overlap(keywordNames, a.keywords);
  const keywordB = overlap(keywordNames, b.keywords);
  const castNames: string[] = candidate.__cast ?? [];
  const castA = overlap(castNames, a.cast);
  const castB = overlap(castNames, b.cast);
  const directorNames: string[] = candidate.__director ?? [];
  const directorA = overlap(directorNames, a.director);
  const directorB = overlap(directorNames, b.director);
  const languageA = candidate.original_language === a.language;
  const languageB = candidate.original_language === b.language;
  const eraA = year > 0 && Number(a.year) > 0 && Math.abs(year - Number(a.year)) <= 10;
  const eraB = year > 0 && Number(b.year) > 0 && Math.abs(year - Number(b.year)) <= 10;
  const rating = Number(candidate.vote_average ?? 0);
  const ratingA = a.rating !== null && Math.abs(rating - a.rating) <= 1.5;
  const ratingB = b.rating !== null && Math.abs(rating - b.rating) <= 1.5;
  const bothGenres = Math.min(genreA.length, 2) + Math.min(genreB.length, 2);
  const bothKeywords = Math.min(keywordA.length, 3) + Math.min(keywordB.length, 3);
  const bothPeople = Math.min(castA.length, 2) + Math.min(castB.length, 2) + (directorA.length ? 3 : 0) + (directorB.length ? 3 : 0);
  const coverageA = Number(genreA.length > 0 || keywordA.length > 0 || castA.length > 0 || directorA.length > 0 || languageA || eraA || ratingA);
  const coverageB = Number(genreB.length > 0 || keywordB.length > 0 || castB.length > 0 || directorB.length > 0 || languageB || eraB || ratingB);
  const score = bothGenres * 8 + bothKeywords * 5 + bothPeople * 4 + (languageA ? 3 : 0) + (languageB ? 3 : 0) + (eraA ? 2 : 0) + (eraB ? 2 : 0) + (ratingA ? 1 : 0) + (ratingB ? 1 : 0) + (coverageA + coverageB === 2 ? 12 : 0);
  return { score, reasonsA: [...genreA.slice(0, 2).map(id => GENRE_NAMES[Number(id)] ?? `Genre ${id}`), ...keywordA.slice(0, 3), ...castA.slice(0, 2), ...directorA.map(() => 'Shared director'), ...(languageA ? ['Original language'] : []), ...(eraA ? ['Similar release era'] : []), ...(ratingA ? ['Similar audience rating'] : [])], reasonsB: [...genreB.slice(0, 2).map(id => GENRE_NAMES[Number(id)] ?? `Genre ${id}`), ...keywordB.slice(0, 3), ...castB.slice(0, 2), ...directorB.map(() => 'Shared director'), ...(languageB ? ['Original language'] : []), ...(eraB ? ['Similar release era'] : []), ...(ratingB ? ['Similar audience rating'] : [])] };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = [Number(body.firstId), Number(body.secondId)];
    if (ids.some(id => !Number.isInteger(id) || id <= 0) || ids[0] === ids[1]) {
      return NextResponse.json({ error: 'Choose two different movies.' }, { status: 400 });
    }
    const [a, b] = await Promise.all(ids.map(getProfile));
    const sharedGenres = overlap(a.genres.map(String), b.genres.map(String)).map(Number);
    const sharedKeywords = overlap(a.keywords, b.keywords);
    const candidateIds = unique([...a.recommendations, ...a.similar, ...b.recommendations, ...b.similar]).filter(id => !ids.includes(id)).slice(0, 60);
    const discoverParams: Record<string, string> = { sort_by: 'popularity.desc', include_adult: 'false', page: '1' };
    if (sharedGenres.length) discoverParams.with_genres = sharedGenres.join('|');
    else {
      const mixedGenres = unique([...a.genres, ...b.genres]).slice(0, 5);
      if (mixedGenres.length) discoverParams.with_genres = mixedGenres.join('|');
    }
    if (sharedKeywords.length) {
      const keywordSearch = await tmdb('/search/keyword', { query: sharedKeywords.slice(0, 2).join(' ') });
      const keywordIds = (keywordSearch.results ?? []).slice(0, 3).map((x: AnyRecord) => x.id);
      if (keywordIds.length) discoverParams.with_keywords = keywordIds.join('|');
    }
    const discovered = await tmdb('/discover/movie', discoverParams);
    const pool = unique([...candidateIds, ...(discovered.results ?? []).map((x: AnyRecord) => x.id)]).filter(id => !ids.includes(id)).slice(0, 55);
    if (!pool.length) return NextResponse.json({ match: null, runnersUp: [], reasonA: [], reasonB: [] });
    const candidateRows = new Map<number, AnyRecord>();
    for (const item of [...(discovered.results ?? []), ...pool.map(id => ({ id }))]) candidateRows.set(item.id, { ...candidateRows.get(item.id), ...item });
    const detailIds = pool.slice(0, 14);
    const details: (AnyRecord | null)[] = [];
    for (let offset = 0; offset < detailIds.length; offset += 4) {
      const batch = await Promise.all(detailIds.slice(offset, offset + 4).map(async id => {
        try {
          const d = await tmdb(`/movie/${id}`, { append_to_response: 'keywords,credits' });
          const row = candidateRows.get(id) ?? {};
          return { ...row, ...d, __keywords: (d.keywords?.keywords ?? []).map((x: AnyRecord) => norm(x.name)), __cast: (d.credits?.cast ?? []).slice(0, 15).map((x: AnyRecord) => norm(x.name)), __director: (d.credits?.crew ?? []).filter((x: AnyRecord) => x.job === 'Director').map((x: AnyRecord) => norm(x.name)) };
        } catch { return candidateRows.get(id) ?? null; }
      }));
      details.push(...batch);
    }
    const ranked = details.filter((x): x is AnyRecord => Boolean(x?.id && (x.title || x.original_title) && (x.poster_path || x.overview))).map(candidate => {
      const scored = scoreCandidate(candidate, a, b);
      return { candidate, ...scored };
    }).sort((x, y) => y.score - x.score || Number(y.candidate.popularity ?? 0) - Number(x.candidate.popularity ?? 0));
    const toResult = (entry: typeof ranked[number]) => {
      const c = entry.candidate;
      const releaseDate = c.release_date ?? '';
      return {
        id: c.id, mediaType: 'movie', title: c.title ?? c.original_title ?? 'Untitled', overview: c.overview ?? '',
        poster: image(c.poster_path), backdrop: image(c.backdrop_path, 'w780'), releaseDate,
        year: releaseDate.slice(0, 4), rating: typeof c.vote_average === 'number' ? c.vote_average : null,
        language: c.original_language ?? '', genres: (c.genre_ids ?? c.genres?.map((x: AnyRecord) => x.id) ?? []).map(Number), genreNames: (c.genres ?? []).map((x: AnyRecord) => x.name),
        trailerKey: null, trailerThumb: null, providers: [], watchLink: `https://www.themoviedb.org/movie/${c.id}`,
      };
    };
    const top = ranked[0];
    return NextResponse.json({
      match: top ? toResult(top) : null,
      reasonA: top ? top.reasonsA : [], reasonB: top ? top.reasonsB : [],
      runnersUp: ranked.slice(1, 6).map(toResult),
      selected: [{ id: a.id, title: a.title }, { id: b.id, title: b.title }],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Movie Collide failed.' }, { status: 500 });
  }
}
