
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

type AnyRecord = Record<string, any>;
type MediaKind = 'movie' | 'tv';

async function tmdb(
  path: string,
  params: Record<string, string> = {}
): Promise<AnyRecord> {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();

  if (!token && !key) {
    throw new Error(
      'TMDB credentials are missing. Add TMDB_ACCESS_TOKEN in Vercel Environment Variables.'
    );
  }

  const url = new URL(`${BASE}${path}`);

  Object.entries(params).forEach(([k, v]) => {
    if (v !== '') url.searchParams.set(k, v);
  });

  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (key) {
    url.searchParams.set('api_key', key);
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      'Could not connect to TMDB. Check the server network connection and try again.'
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'TMDB rejected the credentials. Check the Read Access Token in Vercel.'
      );
    }

    if (response.status === 403) {
      throw new Error(
        'TMDB denied this request. Check your API access permissions.'
      );
    }

    throw new Error(`TMDB request failed (${response.status}).`);
  }

  return response.json();
}

function getImage(
  path: string | null | undefined,
  size = 'w500'
): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

function getReleaseDate(item: AnyRecord): string {
  return item.release_date ?? item.first_air_date ?? '';
}

async function enrich(
  item: AnyRecord,
  type: MediaKind,
  region: string
) {
  let details: AnyRecord = {};

  try {
    details = await tmdb(`/${type}/${item.id}`, {
      append_to_response: 'videos,watch/providers',
      language: 'en-US',
    });
  } catch (error) {
    console.error(
      `REELRADAR details lookup failed for ${type} ${item.id}:`,
      error
    );
  }

  const videos = details.videos?.results ?? [];

  const trailer =
    videos.find(
      (v: AnyRecord) =>
        v.site === 'YouTube' &&
        v.type === 'Trailer' &&
        v.official
    ) ??
    videos.find(
      (v: AnyRecord) =>
        v.site === 'YouTube' && v.type === 'Trailer'
    ) ??
    videos.find(
      (v: AnyRecord) => v.site === 'YouTube'
    );

  const providerData =
    details['watch/providers']?.results?.[region];

  const providerList = [
    ...(providerData?.flatrate ?? []),
    ...(providerData?.rent ?? []),
    ...(providerData?.buy ?? []),
  ];

  const providers = providerList
    .filter(
      (p: AnyRecord, index: number, array: AnyRecord[]) =>
        array.findIndex(
          x => x.provider_id === p.provider_id
        ) === index
    )
    .slice(0, 4)
    .map((p: AnyRecord) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo: getImage(p.logo_path, 'w92'),
    }));

  const date = getReleaseDate(item);

  return {
    id: item.id,
    mediaType: type,
    title: item.title ?? item.name ?? 'Untitled',
    overview: item.overview ?? '',
    poster: getImage(item.poster_path),
    backdrop: getImage(item.backdrop_path, 'w1280'),
    releaseDate: date,
    year: date.slice(0, 4),

    rating:
      typeof item.vote_average === 'number'
        ? Number(item.vote_average.toFixed(1))
        : null,

    language:
      typeof item.original_language === 'string'
        ? item.original_language
        : '',

    genres: Array.isArray(item.genre_ids)
      ? item.genre_ids
      : (details.genres ?? []).map(
          (g: AnyRecord) => g.id
        ),

    trailerKey: trailer?.key ?? null,

    trailerThumb: trailer?.key
      ? `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg`
      : null,

    providers,
    watchLink: providerData?.link ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;

    const requestedType = search.get('type') ?? 'all';

    const type = [
      'movie',
      'tv',
      'documentary',
    ].includes(requestedType)
      ? requestedType
      : 'all';

    const language = (
      search.get('language') ?? ''
    ).trim();

    const regionValue = (
      search.get('region') ?? 'IN'
    ).trim().toUpperCase();

    const region = /^[A-Z]{2}$/.test(regionValue)
      ? regionValue
      : 'IN';

    const query = (
      search.get('query') ?? ''
    ).trim();

    const pageValue = Number(
      search.get('page') ?? '1'
    );

    const page = Number.isInteger(pageValue)
      ? Math.min(Math.max(pageValue, 1), 500)
      : 1;

    const today = new Date();
    const from = new Date(today);

    from.setDate(today.getDate() - 120);

    const formatDate = (date: Date) =>
      date.toISOString().slice(0, 10);

    const kinds: MediaKind[] =
      type === 'movie'
        ? ['movie']
        : type === 'tv'
          ? ['tv']
          : ['movie', 'tv'];

    const requests = await Promise.all(
      kinds.map(async kind => {
        if (query) {
          const data = await tmdb(
            `/search/${kind}`,
            {
              query,
              include_adult: 'false',
              language: 'en-US',
              page: String(page),
            }
          );

          return (data.results ?? [])
            .filter((item: AnyRecord) => {
              const languageMatches =
                !language ||
                item.original_language === language;

              const documentaryMatches =
                type !== 'documentary' ||
                (item.genre_ids ?? []).includes(99);

              return (
                languageMatches &&
                documentaryMatches
              );
            })
            .map((item: AnyRecord) => ({
              ...item,
              _kind: kind,
            }));
        }

        const params: Record<string, string> = {
          include_adult: 'false',

          sort_by:
            kind === 'movie'
              ? 'primary_release_date.desc'
              : 'first_air_date.desc',

          page: String(page),
          language: 'en-US',
          region,
        };

        if (language) {
          params.with_original_language = language;
        }

        if (kind === 'movie') {
          params['primary_release_date.gte'] =
            formatDate(from);

          params['primary_release_date.lte'] =
            formatDate(today);
        } else {
          params['first_air_date.gte'] =
            formatDate(from);

          params['first_air_date.lte'] =
            formatDate(today);
        }

        if (type === 'documentary') {
          params.with_genres = '99';
        }

        const data = await tmdb(
          `/discover/${kind}`,
          params
        );

        return (data.results ?? []).map(
          (item: AnyRecord) => ({
            ...item,
            _kind: kind,
          })
        );
      })
    );

    const raw: AnyRecord[] = requests
      .flat()
      .sort((a, b) =>
        getReleaseDate(b).localeCompare(
          getReleaseDate(a)
        )
      )
      .slice(0, 18);

    const results = await Promise.all(
      raw.map(item =>
        enrich(
          item,
          item._kind as MediaKind,
          region
        )
      )
    );

    return NextResponse.json(
      {
        results,
        page,
        region,
        totalResults: results.length,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control':
            's-maxage=1800, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    console.error(
      'REELRADAR discovery error:',
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load titles.';

    return NextResponse.json(
      {
        error: message,
        results: [],
      },
      { status: 500 }
    );
  }
}
