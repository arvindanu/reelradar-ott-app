
import dropTimes from '../../../data/drop-times.json';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TmdbItem = Record<string, any>;
type MediaType = 'movie' | 'tv';
type ReleaseType = 'theatre' | 'ott';

const IMAGE = 'https://image.tmdb.org/t/p';
const BASE = 'https://api.themoviedb.org/3';
const WINDOW_DAYS = 45;
const MAX_ITEMS = 35;

function dateOnly(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : '';
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function normalize(
  item: TmdbItem,
  mediaType: MediaType,
  releaseType: ReleaseType,
  releaseDateOverride?: string,
  documentary = false,
) {
  const episode = mediaType === 'tv' ? item.next_episode_to_air : null;

  const date = dateOnly(
    releaseDateOverride ||
    (mediaType === 'movie'
      ? item.release_date
      : episode?.air_date || item.first_air_date),
  );

  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids
    : Array.isArray(item.genres)
      ? item.genres.map((genre: TmdbItem) => genre.id)
      : [];

  return {
    id: Number(item.id),
    mediaType,
    title: String(
      mediaType === 'movie'
        ? item.title || item.original_title
        : item.name || item.original_name || item.title,
    ),
    overview: String(item.overview || ''),
    poster: item.poster_path ? `${IMAGE}/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `${IMAGE}/w1280${item.backdrop_path}` : null,
    releaseDate: date,
    year: date ? date.slice(0, 4) : '',
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
    language: String(item.original_language || ''),
    genres,
    popularity: Number(item.popularity || 0),
    releaseType: mediaType === 'movie' ? releaseType : 'ott',
    contentType:
      documentary || genres.includes(99)
        ? 'documentary'
        : mediaType === 'tv'
          ? 'series'
          : 'movie',
    seasonNumber: episode?.season_number ?? null,
    episodeNumber: episode?.episode_number ?? null,
    episodeTitle: episode?.name ?? null,
    episodeOverview: episode?.overview ?? null,
    runtime: null,
    nextEpisode: Boolean(episode),
    providers: [] as string[],
  };
}

export async function GET(request: NextRequest) {
  const requestedRegion = (
    request.nextUrl.searchParams.get('region') || 'IN'
  ).toUpperCase();

  let timeZone = request.nextUrl.searchParams.get('timezone') || 'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    timeZone = 'UTC';
  }

  const token = process.env.TMDB_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (!token && !apiKey) {
    return NextResponse.json(
      {
        error:
          'TMDB credentials are missing. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to your environment.',
      },
      { status: 500 },
    );
  }

  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
        accept: 'application/json',
      }
    : { accept: 'application/json' };

  const get = async (
    path: string,
    params: Record<string, string> = {},
  ): Promise<any> => {
    const url = new URL(`${BASE}${path}`);

    if (apiKey && !token) {
      url.searchParams.set('api_key', apiKey);
    }

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`TMDB request failed (${response.status}): ${path}`);
    }

    return response.json();
  };

  try {
    // Load TMDB's actual supported streaming regions.
    const [regionsResponse, languagesResponse] = await Promise.all([
      get('/watch/providers/regions', { language: 'en-US' }),
      get('/configuration/languages'),
    ]);

    const regions = (regionsResponse.results || [])
      .map((region: TmdbItem) => ({
        code: String(region.iso_3166_1 || '').toUpperCase(),
        name: String(region.english_name || region.native_name || ''),
      }))
      .filter((region: { code: string; name: string }) => region.code && region.name)
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name),
      );

    const region = regions.some(
      (entry: { code: string }) => entry.code === requestedRegion,
    )
      ? requestedRegion
      : 'IN';

    const languages = (languagesResponse || [])
      .map((language: TmdbItem) => ({
        code: String(language.iso_639_1 || ''),
        name: String(language.english_name || language.name || ''),
      }))
      .filter((language: { code: string; name: string }) =>
        language.code && language.name,
      )
      .sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name),
      );

    // Calculate the date range in the user's selected timezone.
    const now = new Date();

    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const today = [
      dateParts.find((part) => part.type === 'year')?.value,
      dateParts.find((part) => part.type === 'month')?.value,
      dateParts.find((part) => part.type === 'day')?.value,
    ].join('-');

    const end = addDays(today, WINDOW_DAYS);

    // Regional movie theatrical and digital release dates.
    // Release type 2 = limited theatrical.
    // Release type 3 = theatrical.
    // Release type 4 = digital.
    const [theatreResponse, digitalResponse, airingToday, onAir, upcomingTv, upcomingEpisodes, docMovies, docTv] =
      await Promise.all([
        get('/discover/movie', {
          region,
          'release_date.gte': today,
          'release_date.lte': end,
          with_release_type: '3|2',
          sort_by: 'release_date.asc',
          page: '1',
        }),

        get('/discover/movie', {
          region,
          'release_date.gte': today,
          'release_date.lte': end,
          with_release_type: '4',
          sort_by: 'release_date.asc',
          page: '1',
        }),

        get('/tv/airing_today', { page: '1' }),
        get('/tv/on_the_air', { page: '1' }),

        // New series premieres.
        get('/discover/tv', {
          'first_air_date.gte': today,
          'first_air_date.lte': end,
          sort_by: 'first_air_date.asc',
          page: '1',
        }),

        // Existing series with episodes airing during the date window.
        get('/discover/tv', {
          'air_date.gte': today,
          'air_date.lte': end,
          sort_by: 'first_air_date.asc',
          page: '1',
        }),

        get('/discover/movie', {
          region,
          with_genres: '99',
          'release_date.gte': today,
          'release_date.lte': end,
          with_release_type: '3|2|4',
          sort_by: 'release_date.asc',
          page: '1',
        }),

        get('/discover/tv', {
          with_genres: '99',
          'first_air_date.gte': today,
          'first_air_date.lte': end,
          sort_by: 'first_air_date.asc',
          page: '1',
        }),
      ]);

    const theatreItems = (theatreResponse.results || []).map((item: TmdbItem) =>
      normalize(item, 'movie', 'theatre'),
    );

    const digitalItems = (digitalResponse.results || []).map((item: TmdbItem) =>
      normalize(item, 'movie', 'ott'),
    );

    const documentaryMovieItems = (docMovies.results || []).map((item: TmdbItem) => {
      const isDigital = digitalItems.some((entry: any) => entry.id === Number(item.id));

      return normalize(
        item,
        'movie',
        isDigital ? 'ott' : 'theatre',
        undefined,
        true,
      );
    });

    // Combine all TV sources and remove duplicates before requesting details.
    const tvRaw = new Map<number, TmdbItem>();

    for (const item of [
      ...(airingToday.results || []),
      ...(onAir.results || []),
      ...(upcomingTv.results || []),
      ...(upcomingEpisodes.results || []),
      ...(docTv.results || []),
    ]) {
      if (item?.id) {
        tvRaw.set(Number(item.id), {
          ...tvRaw.get(Number(item.id)),
          ...item,
        });
      }
    }

    // Get full series details so next_episode_to_air is available.
    const seriesDetails = await Promise.all(
      [...tvRaw.values()].slice(0, MAX_ITEMS).map(async (item) => {
        try {
          const details = await get(`/tv/${item.id}`);
          return { ...item, ...details };
        } catch {
          return item;
        }
      }),
    );

    const seriesItems = seriesDetails
      .map((item) => normalize(item, 'tv', 'ott'))
      .filter((item: any) => {
        if (!item.releaseDate) return false;
        return item.releaseDate >= today && item.releaseDate <= end;
      });

    const documentaryTvItems = seriesItems
      .filter((item: any) => item.contentType === 'documentary');

    // Attach regional streaming providers.
    // TMDB returns current provider availability, not a guaranteed future launch date.
    const providerCache = new Map<string, string[]>();

    const getProviders = async (
      mediaType: MediaType,
      id: number,
    ): Promise<string[]> => {
      const key = `${mediaType}:${id}`;

      if (providerCache.has(key)) {
        return providerCache.get(key)!;
      }

      try {
        const endpoint =
          mediaType === 'movie'
            ? `/movie/${id}/watch/providers`
            : `/tv/${id}/watch/providers`;

        const response = await get(endpoint);
        const regional = response.results?.[region];

        const providerGroups = [
          ...(regional?.flatrate || []),
          ...(regional?.free || []),
          ...(regional?.ads || []),
        ];

        const names = [
          ...new Set(
            providerGroups
              .map((provider: TmdbItem) => String(provider.provider_name || ''))
              .filter(Boolean),
          ),
        ];

        providerCache.set(key, names);
        return names;
      } catch {
        providerCache.set(key, []);
        return [];
      }
    };

    const combined = new Map<string, any>();

    for (const item of [
      ...theatreItems,
      ...digitalItems,
      ...documentaryMovieItems,
      ...seriesItems,
      ...documentaryTvItems,
    ]) {
      const key = `${item.mediaType}:${item.id}:${item.releaseDate}`;

      if (!combined.has(key)) {
        combined.set(key, item);
      } else if (item.contentType === 'documentary') {
        combined.set(key, {
          ...combined.get(key),
          contentType: 'documentary',
        });
      }
    }

    const overrides =
      (dropTimes as {
        releases?: Record<string, { time?: string; timezone?: string }>;
      }).releases || {};

    const items = [...combined.values()];

    // Attach provider data only to the items that will be returned.
    await Promise.all(
      items.map(async (item) => {
        item.providers = await getProviders(item.mediaType, item.id);
      }),
    );

    const withOverrides = (item: any) => {
      const override = overrides[String(item.id)];

      return override?.time
        ? {
            ...item,
            exactTime: override.time,
            timeZone: override.timezone || 'Asia/Kolkata',
          }
        : item;
    };

    const finalItems = items
      .map(withOverrides)
      .sort(
        (a, b) =>
          (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999') ||
          b.popularity - a.popularity,
      );

    const awaited = [...theatreItems, ...digitalItems, ...seriesItems]
      .filter((item: any) => item.releaseDate && item.popularity >= 35)
      .sort((a: any, b: any) => b.popularity - a.popularity)
      .filter(
        (item: any, index: number, list: any[]) =>
          list.findIndex(
            (other) =>
              other.id === item.id && other.mediaType === item.mediaType,
          ) === index,
      )
      .slice(0, 7)
      .map(withOverrides);

    return NextResponse.json(
      {
        items: finalItems,
        awaited,
        region,
        regions,
        languages,
        updatedAt: new Date().toISOString(),
        range: { from: today, to: end },
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'CDN-Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('DropClock API error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load live release data.',
      },
      { status: 502 },
    );
  }
}
