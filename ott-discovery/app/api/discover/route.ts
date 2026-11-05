import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

type AnyRecord = Record<string, any>;
type MediaKind = 'movie' | 'tv';

function getAuthHeaders(): Record<string, string> {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new Error(
      'TMDB_ACCESS_TOKEN is missing. Check your .env.local file.'
    );
  }

  return {
    Authorization: `Bearer ${token}`,
    accept: 'application/json',
  };
}

async function tmdb(
  path: string,
  params: Record<string, string> = {}
): Promise<AnyRecord> {
  const url = new URL(`${BASE}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders(),
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    const errorBody = await response.text();

    console.error('TMDB API error:', {
      path,
      status: response.status,
      response: errorBody.slice(0, 500),
    });

    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function getImageUrl(
  path: string | null | undefined,
  size = 'w500'
): string | null {
  return path ? `${IMG}/${size}${path}` : null;
}

function getReleaseDate(item: AnyRecord): string {
  return item.release_date ?? item.first_air_date ?? '';
}

function getTitle(item: AnyRecord): string {
  return item.title ?? item.name ?? 'Untitled';
}

async function enrich(
  item: AnyRecord,
  kind: MediaKind,
  region: string
): Promise<AnyRecord> {
  const [detailsResult, providersResult] = await Promise.allSettled([
    tmdb(`/${kind}/${item.id}`, {
      append_to_response: 'videos',
      language: 'en-US',
    }),
    tmdb(`/${kind}/${item.id}/watch/providers`),
  ]);

  const details =
    detailsResult.status === 'fulfilled'
      ? detailsResult.value
      : {};

  const providerResponse =
    providersResult.status === 'fulfilled'
      ? providersResult.value
      : {};

  if (detailsResult.status === 'rejected') {
    console.error(
      `Details unavailable for ${kind} ${item.id}:`,
      detailsResult.reason
    );
  }

  if (providersResult.status === 'rejected') {
    console.error(
      `Providers unavailable for ${kind} ${item.id}:`,
      providersResult.reason
    );
  }

  // Find the official YouTube trailer.
  const videos: AnyRecord[] = details.videos?.results ?? [];

  const trailer =
    videos.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer' &&
        video.official === true
    ) ??
    videos.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer'
    ) ??
    null;

  // Get streaming providers for the requested country.
  const providerData =
    providerResponse.results?.[region] ?? null;

  const availabilityGroups = [
    ...(providerData?.flatrate ?? []).map((p: AnyRecord) => ({
      ...p,
      availability: 'stream',
    })),
    ...(providerData?.free ?? []).map((p: AnyRecord) => ({
      ...p,
      availability: 'free',
    })),
    ...(providerData?.ads ?? []).map((p: AnyRecord) => ({
      ...p,
      availability: 'ads',
    })),
    ...(providerData?.rent ?? []).map((p: AnyRecord) => ({
      ...p,
      availability: 'rent',
    })),
    ...(providerData?.buy ?? []).map((p: AnyRecord) => ({
      ...p,
      availability: 'buy',
    })),
  ];

  // Combine duplicate providers while retaining their availability types.
  const providerMap = new Map<number, AnyRecord>();

  for (const provider of availabilityGroups) {
    const existing = providerMap.get(provider.provider_id);

    if (existing) {
      if (!existing.availabilityTypes.includes(provider.availability)) {
        existing.availabilityTypes.push(provider.availability);
      }
    } else {
      providerMap.set(provider.provider_id, {
        provider_id: provider.provider_id,
        provider_name: provider.provider_name,
        logo_path: provider.logo_path,
        logo_url: getImageUrl(provider.logo_path, 'w92'),
        display_priority: provider.display_priority,
        availability: provider.availability,
        availabilityTypes: [provider.availability],
      });
    }
  }

  const providers = Array.from(providerMap.values()).sort(
    (a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)
  );

  return {
    ...item,
    ...details,

    id: item.id,
    _kind: kind,
    media_type: kind,

    title: getTitle({ ...item, ...details }),
    posterUrl: getImageUrl(item.poster_path, 'w500'),
    backdropUrl: getImageUrl(item.backdrop_path, 'w1280'),

    rating: item.vote_average ?? 0,
    vote_average: item.vote_average ?? 0,

    releaseDate: getReleaseDate(item),

    trailer: trailer
      ? {
          key: trailer.key,
          name: trailer.name,
          site: trailer.site,
          type: trailer.type,
          url: `https://www.youtube.com/watch?v=${trailer.key}`,
          thumbnail: `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg`,
        }
      : null,

    trailerKey: trailer?.key ?? null,

    providers,
    providerNames: providers.map((p) => p.provider_name),

    watchLink: providerData?.link ?? null,

    region,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedType = searchParams.get('type') ?? 'all';
    const language = searchParams.get('language') ?? '';
    const requestedRegion = (
      searchParams.get('region') ?? 'IN'
    ).toUpperCase();

    const query = (searchParams.get('query') ?? '').trim();

    const page = Math.min(
      500,
      Math.max(
        1,
        Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
      )
    );

    const region = /^[A-Z]{2}$/.test(requestedRegion)
      ? requestedRegion
      : 'IN';

    if (
      !['all', 'movie', 'tv', 'documentary'].includes(requestedType)
    ) {
      return NextResponse.json(
        { error: 'Invalid content type.' },
        { status: 400 }
      );
    }

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 120);

    const formatDate = (date: Date) =>
      date.toISOString().slice(0, 10);

    const kinds: MediaKind[] =
      requestedType === 'movie'
        ? ['movie']
        : requestedType === 'tv'
          ? ['tv']
          : ['movie', 'tv'];

    // Fetch movie and TV results in parallel.
    const requests = await Promise.all(
      kinds.map(async (kind) => {
        // Search mode.
        if (query) {
          const search = await tmdb(`/search/${kind}`, {
            query,
            include_adult: 'false',
            language: 'en-US',
            page: String(page),
          });

          return (search.results ?? [])
            .filter((item: AnyRecord) => {
              const matchesLanguage =
                !language || item.original_language === language;

              const matchesDocumentary =
                requestedType !== 'documentary' ||
                (item.genre_ids ?? []).includes(99);

              return matchesLanguage && matchesDocumentary;
            })
            .map((item: AnyRecord) => ({
              ...item,
              _kind: kind,
            }));
        }

        // Discovery mode.
        const params: Record<string, string> = {
          include_adult: 'false',
          sort_by:
            kind === 'movie'
              ? 'primary_release_date.desc'
              : 'first_air_date.desc',
          page: String(page),
          language: 'en-US',
          with_watch_monetization_types: 'flatrate|free|ads|rent|buy',
        };

        if (language) {
          params.with_original_language = language;
        }

        if (requestedType === 'documentary') {
          params.with_genres = '99';
        }

        if (kind === 'movie') {
          params.region = region;
          params['primary_release_date.gte'] = formatDate(from);
          params['primary_release_date.lte'] = formatDate(today);
        } else {
          params.watch_region = region;
          params['first_air_date.gte'] = formatDate(from);
          params['first_air_date.lte'] = formatDate(today);
        }

        const data = await tmdb(`/discover/${kind}`, params);

        return (data.results ?? []).map((item: AnyRecord) => ({
          ...item,
          _kind: kind,
        }));
      })
    );

    // Combine and sort by release date.
    const raw: AnyRecord[] = requests
      .flat()
      .sort((a, b) =>
        getReleaseDate(b).localeCompare(getReleaseDate(a))
      )
      .slice(0, 18);

    // Enrich each title independently.
    const enriched = await Promise.all(
      raw.map(async (item) => {
        try {
          return await enrich(item, item._kind as MediaKind, region);
        } catch (error) {
          console.error(
            `Failed to enrich ${item._kind} ${item.id}:`,
            error
          );

          return {
            ...item,
            title: getTitle(item),
            posterUrl: getImageUrl(item.poster_path),
            backdropUrl: getImageUrl(item.backdrop_path, 'w1280'),
            rating: item.vote_average ?? 0,
            releaseDate: getReleaseDate(item),
            trailer: null,
            trailerKey: null,
            providers: [],
            providerNames: [],
            watchLink: null,
          };
        }
      })
    );

    return NextResponse.json(
      {
        results: enriched,
        page,
        region,
        totalResults: enriched.length,
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
    console.error('REELRADAR discovery error:', error);

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
