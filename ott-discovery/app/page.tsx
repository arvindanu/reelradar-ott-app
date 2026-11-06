'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { Search, SlidersHorizontal, Play, Star, ArrowUpRight, Film, Clapperboard, Globe2, Sparkles, ChevronDown, X, Menu, Radio, ExternalLink, CalendarDays, Users, Award, Clock3, Share2, Heart, GitMerge, Check, Compass, Dices, Hourglass, ScanEye } from 'lucide-react';
import { COUNTRIES, LANGUAGES } from '@/lib/catalog';

type Provider = { id: number; name: string; logo: string | null };
type PlatformOption = { id: number; name: string; logo: string | null };
type Person = { id: number; name: string; role?: string; character?: string; profile?: string | null };
type Title = {
  id: number; mediaType: 'movie' | 'tv'; title: string; overview: string;
  poster: string | null; backdrop: string | null; releaseDate: string;
  year: string; rating: number | null; language: string; genres: number[];
  trailerKey: string | null; trailerThumb: string | null;
  providers: Provider[]; watchLink: string | null;
};
type FullDetails = {
  title: string; originalTitle?: string; tagline?: string; status?: string;
  genres?: string[]; keywords?: string[]; countries?: string[]; networks?: string[];
  runtime?: number | null; episodeRuntime?: number | null; numberOfSeasons?: number;
  numberOfEpisodes?: number; firstAirDate?: string; lastAirDate?: string;
  nextEpisode?: string | null; contentRating?: string | null; director?: string[];
  creators?: string[]; cast?: Person[]; crew?: Person[]; productionCompanies?: string[];
  voteCount?: number; popularity?: number; budget?: number; revenue?: number;
  homepage?: string | null; imdbId?: string | null; reviews?: Review[];
};
type Mode = 'all' | 'movie' | 'tv' | 'documentary';
type Availability = 'ott' | 'all' | 'theatre';
type Review = {
  id: string; author: string; authorDetails?: { username?: string; rating?: number | null };
  content: string; createdAt?: string; url?: string | null;
};
type CollisionResult = { match: (Title & { genreNames?: string[] }) | null; runnersUp: Title[]; reasonA: string[]; reasonB: string[]; selected?: { id: number; title: string }[] };

const DISCOVERY_FILTERS = [
  'Trending Now', 'Popular', 'Top Rated', 'Now Playing',
  'Upcoming', 'Hidden Gems', 'Classics'
] as const;
type DiscoveryFilter = typeof DISCOVERY_FILTERS[number] | '';

const MOVIE_GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' }, { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' }, { id: 878, name: 'Science Fiction' }
] as const;
const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' },
  { id: 9648, name: 'Mystery' }, { id: 10765, name: 'Sci-Fi & Fantasy' }
] as const;
const SHARED_GENRES = [
  { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' },
  { id: 9648, name: 'Mystery' }
] as const;
const WISHLIST_STORAGE_KEY = 'reelradar-wishlist-v1';

function getProviderWatchUrl(providerName: string, title: string, fallback: string | null) {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();
  if (name.includes('netflix')) return `https://www.netflix.com/search?q=${query}`;
  if (name.includes('prime video') || name.includes('amazon prime')) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}`;
  if (name.includes('disney')) return `https://www.disneyplus.com/search?q=${query}`;
  if (name.includes('apple tv')) return `https://tv.apple.com/search?term=${query}`;
  if (name.includes('hulu')) return `https://www.hulu.com/search?q=${query}`;
  if (name.includes('max')) return `https://www.max.com/search?q=${query}`;
  if (name.includes('paramount')) return `https://www.paramountplus.com/search/?query=${query}`;
  if (name.includes('peacock')) return `https://www.peacocktv.com/search?q=${query}`;
  if (name.includes('crunchyroll')) return `https://www.crunchyroll.com/search?q=${query}`;
  if (name.includes('hotstar')) return `https://www.hotstar.com/in/search?q=${query}`;
  if (name.includes('zee5')) return `https://www.zee5.com/search?q=${query}`;
  if (name.includes('sonyliv')) return `https://www.sonyliv.com/search?q=${query}`;
  return fallback ?? `https://www.google.com/search?q=${encodeURIComponent(`${title} ${providerName} streaming`)}`;
}

const LANG_LABEL: Record<string, string> = Object.fromEntries(LANGUAGES.map(x => [x.code, x.label]));
const getLanguageLabel = (language?: string | null) => !language ? 'Unknown language' : (LANG_LABEL[language] ?? language.toUpperCase());

function normalizeTitle(value: unknown): Title | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Partial<Title>;
  if (typeof x.id !== 'number' || typeof x.title !== 'string') return null;
  return {
    id: x.id, mediaType: x.mediaType === 'tv' ? 'tv' : 'movie',
    title: x.title, overview: x.overview ?? '', poster: x.poster ?? null,
    backdrop: x.backdrop ?? null, releaseDate: x.releaseDate ?? '',
    year: x.year ?? '', rating: typeof x.rating === 'number' ? x.rating : null,
    language: typeof x.language === 'string' ? x.language : '',
    genres: Array.isArray(x.genres) ? x.genres : [],
    trailerKey: x.trailerKey ?? null, trailerThumb: x.trailerThumb ?? null,
    providers: Array.isArray(x.providers) ? x.providers : [], watchLink: x.watchLink ?? null,
  };
}

function Poster({ item, onOpen, selectionMode = false, selectedIndex = -1, onToggleSelect }: { item: Title; onOpen: (x: Title) => void; selectionMode?: boolean; selectedIndex?: number; onToggleSelect?: (x: Title) => void }) {
  const trailerUrl = item.trailerKey
    ? `https://www.youtube.com/watch?v=${item.trailerKey}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' official trailer')}`;
  return <article className={`poster-card ${selectionMode && selectedIndex >= 0 ? 'collide-selected' : ''}`} onClick={() => selectionMode && item.mediaType === 'movie' && onToggleSelect ? onToggleSelect(item) : onOpen(item)} tabIndex={0}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectionMode && item.mediaType === 'movie' && onToggleSelect ? onToggleSelect(item) : onOpen(item); } }}>
    <div className="poster-art">
      {item.poster ? <img src={item.poster} alt={`${item.title} poster`} loading="lazy" /> : <div className="poster-fallback"><Film size={30} /><span>{item.title}</span></div>}
      <div className="poster-shade" />
      {selectionMode && <div className={`collide-select-mark ${selectedIndex >= 0 ? 'is-selected' : ''}`} aria-label={selectedIndex >= 0 ? `Selected ${selectedIndex + 1}` : 'Select movie'}>{selectedIndex >= 0 ? <><Check size={15} /> {selectedIndex + 1}</> : <GitMerge size={16} />}</div>}
      <div className="poster-topline"><span className="type-pill">{item.mediaType === 'tv' ? 'SERIES' : 'FILM'}</span>
        {item.rating !== null && <span className="rating"><Star size={11} fill="currentColor" /> {item.rating.toFixed(1)}</span>}</div>
      <button className="quick-play" type="button" aria-label={`View ${item.title}`} onClick={e => { e.stopPropagation(); selectionMode && item.mediaType === 'movie' && onToggleSelect ? onToggleSelect(item) : onOpen(item); }}><Play size={16} fill="currentColor" /></button>
      <div className="poster-info"><h3>{item.title}</h3><p>{item.year || 'Release date TBA'} <span>·</span> {getLanguageLabel(item.language)}</p></div>
    </div>
    <a className="card-trailer" href={trailerUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <span className="trailer-thumb">{item.trailerThumb ? <img src={item.trailerThumb} alt="" loading="lazy" /> : <Play size={12} />}<Play size={9} fill="currentColor" /></span>
      <span>WATCH TRAILER</span><ArrowUpRight size={12} />
    </a>
    <div className="card-meta"><div className="provider-stack">{item.providers.length ? item.providers.slice(0, 3).map(p => p.logo
      ? <img key={p.id} src={p.logo} alt={p.name} title={p.name} />
      : <span key={p.id} title={p.name}>{p.name.slice(0, 1)}</span>) : <span className="provider-empty">No OTT data</span>}</div><span className="card-arrow"><ArrowUpRight size={15} /></span></div>
  </article>;
}

function DetailModal({ item, close, region, isWishlisted, onToggleWishlist }: { item: Title; close: () => void; region: string; isWishlisted: boolean; onToggleWishlist: (item: Title) => void }) {
  const [details, setDetails] = useState<FullDetails | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(true);
  const [expandedReviews, setExpandedReviews] = useState<string[]>([]);
  const trailer = item.trailerKey ? `https://www.youtube.com/watch?v=${item.trailerKey}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' official trailer')}`;

  useEffect(() => {
    let active = true;
    setDetailLoading(true); setDetailError('');
    fetch(`/api/details?type=${item.mediaType}&id=${item.id}&region=${region}`)
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not load title details'); return data as FullDetails; })
      .then(data => { if (active) setDetails(data); })
      .catch(e => { if (active) setDetailError(e instanceof Error ? e.message : 'Could not load full details.'); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [item.id, item.mediaType, region]);

  const line = (label: string, value?: string | number | null) => value !== undefined && value !== null && value !== ''
    ? <p className="detail-line"><strong>{label}:</strong> {value}</p> : null;

  return <div className="modal-backdrop" onMouseDown={close}>
    <section className="detail-modal" onMouseDown={e => e.stopPropagation()}>
      <button className="modal-close" onClick={close} aria-label="Close" type="button"><X size={18} /></button>
      <div className="modal-hero" style={item.backdrop ? { backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.98),rgba(8,9,13,.58)),url(${item.backdrop})` } : {}}>
        <div className="modal-copy">
          <span className="eyebrow">{item.mediaType === 'tv' ? 'SERIES' : 'MOVIE'} · {item.year || 'Release date TBA'}</span>
          <h2>{item.title}</h2>
          <div className="modal-stats">{item.rating !== null && <span><Star size={14} fill="currentColor" /> {item.rating.toFixed(1)} / 10</span>}<span>{getLanguageLabel(item.language)}</span></div>
          <p>{item.overview || 'Synopsis not available yet.'}</p>
          <a className="primary-cta" href={trailer} target="_blank" rel="noreferrer"><Play size={15} fill="currentColor" /> Watch trailer on YouTube <ExternalLink size={14} /></a>
        </div>
      </div>
      <div className="modal-bottom"><div><span className="eyebrow">WHERE TO WATCH</span><h3>Available on your platforms</h3></div>
        {item.watchLink && <a className="provider-link" href={item.watchLink} target="_blank" rel="noreferrer">All options <ArrowUpRight size={14} /></a>}</div>
      {item.providers.length ? <div className="modal-providers">{item.providers.map(p => <a className="modal-provider" key={p.id}
          href={getProviderWatchUrl(p.name, item.title, item.watchLink)} target="_blank" rel="noopener noreferrer"
          aria-label={`Search for ${item.title} on ${p.name}`} title={`Find ${item.title} on ${p.name}`}>
          {p.logo && <img src={p.logo} alt="" />}<span>{p.name}</span><ExternalLink size={12} />
        </a>)}
        </div> : <p className="no-provider">No streaming availability was returned for this country. Try changing your region.</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, padding: '0 24px 18px' }}>
          <button type="button" aria-label={isWishlisted ? `Remove ${item.title} from wishlist` : `Add ${item.title} to wishlist`}
            onClick={() => onToggleWishlist(item)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 8, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(8,9,13,.72)', color: isWishlisted ? '#DFFF00' : '#fff', cursor: 'pointer', fontWeight: 700 }}>
            <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} /> {isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}
          </button>
          <button type="button" aria-label={`Share ${item.title}`}
            onClick={async () => {
              const url = `https://www.themoviedb.org/${item.mediaType}/${item.id}`;
              try {
                if (navigator.share) await navigator.share({ title: item.title, text: `Discover ${item.title} on REELRADAR`, url });
                else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); window.alert('Title link copied to clipboard.'); }
                else window.prompt('Copy this title link:', url);
              } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') window.alert('Unable to share this title right now.');
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 8, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(8,9,13,.72)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            <Share2 size={15} /> Share
          </button>
      </div>
      {item.trailerThumb && <a className="trailer-preview" href={trailer} target="_blank" rel="noreferrer"><img src={item.trailerThumb} alt="Trailer thumbnail" /><span className="trailer-play"><Play fill="currentColor" /></span><span>PLAY OFFICIAL TRAILER</span></a>}

      <div className="full-details">
        <div className="details-heading"><h3>Title information</h3><span>{detailLoading ? 'LOADING DETAILS…' : 'TMDB DETAILS'}</span></div>
        {detailError && <p className="no-provider">{detailError}</p>}
        {details && <>
          {line('Original title', details.originalTitle)}
          {line('Tagline', details.tagline)}
          {line('Director', details.director?.join(', '))}
          {line('Creator', details.creators?.join(', '))}
          {line('Genres', details.genres?.join(', '))}
          {line('Tags', details.keywords?.join(', '))}
          {line('Country', details.countries?.join(', '))}
          {line('Status', details.status)}
          {item.mediaType === 'tv' ? <>
            {line('Type', 'TV Series')}
            {line('Episodes', details.numberOfEpisodes)}
            {line('Seasons', details.numberOfSeasons)}
            {line('Aired', [details.firstAirDate, details.lastAirDate].filter(Boolean).join(' – '))}
            {line('Next episode', details.nextEpisode)}
            {line('Original network', details.networks?.join(', '))}
            {line('Episode duration', details.episodeRuntime ? `${details.episodeRuntime} min.` : null)}
            {line('Content rating', details.contentRating)}
          </> : <>
            {line('Release date', item.releaseDate)}
            {line('Runtime', details.runtime ? `${details.runtime} min.` : null)}
            {line('Budget', details.budget ? `$${details.budget.toLocaleString()}` : null)}
            {line('Box office', details.revenue ? `$${details.revenue.toLocaleString()}` : null)}
          </>}
          {line('Production companies', details.productionCompanies?.join(', '))}
          {line('Score', item.rating !== null ? `${item.rating.toFixed(1)} / 10 (${(details.voteCount ?? 0).toLocaleString()} votes)` : null)}
          {line('Popularity', typeof details.popularity === 'number' ? details.popularity.toFixed(1) : null)}
          {line('IMDb ID', details.imdbId)}
          {details.homepage && <p className="detail-line"><strong>Official website:</strong> <a href={details.homepage} target="_blank" rel="noreferrer">{details.homepage}</a></p>}
        </>}
        <div className="people-grid">
          <div><h4><Users size={15} /> Cast</h4>{details?.cast?.length ? details.cast.slice(0, 12).map(person =>
            <div className="person-row" key={person.id}>{person.profile && <img src={person.profile} alt="" loading="lazy" />}<span><strong>{person.name}</strong><small>{person.character}</small></span></div>
          ) : <p className="muted-note">Cast information unavailable.</p>}</div>
          <div><h4><Clapperboard size={15} /> Key crew</h4>{details?.crew?.length ? details.crew.slice(0, 12).map(person =>
            <div className="person-row" key={`${person.id}-${person.role}`} >{person.profile && <img src={person.profile} alt="" loading="lazy" />}<span><strong>{person.name}</strong><small>{person.role}</small></span></div>
          ) : <p className="muted-note">Crew information unavailable.</p>}</div>
        </div>
        <section className="reviews-section">
          <div className="details-heading"><h3>Audience reviews</h3><span>{details?.reviews?.length ? `${details.reviews.length} REVIEWS` : 'TMDB REVIEWS'}</span></div>
          {detailLoading ? <p className="muted-note">Loading reviews…</p> : details?.reviews?.length ? details.reviews.map(review => {
            const expanded = expandedReviews.includes(review.id);
            const content = review.content ?? '';
            const needsExpansion = content.length > 420;
            return <article className="review-card" key={review.id}>
              <div className="review-top"><div><strong>{review.author}</strong><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Review'}</small></div>
                {typeof review.authorDetails?.rating === 'number' && <span className="review-rating"><Star size={12} fill="currentColor" /> {review.authorDetails.rating}/10</span>}</div>
              <p>{needsExpansion && !expanded ? `${content.slice(0, 420)}…` : content}</p>
              <div className="review-actions">{needsExpansion && <button type="button" onClick={() => setExpandedReviews(current => expanded ? current.filter(id => id !== review.id) : [...current, review.id])}>{expanded ? 'Read less' : 'Read more'}</button>}
                {review.url && <a href={review.url} target="_blank" rel="noreferrer">View on TMDB <ExternalLink size={12} /></a>}</div>
            </article>;
          }) : <p className="muted-note">No audience reviews are available for this title yet.</p>}
        </section>
      </div>
    </section>
  </div>;
}

export default function Home() {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>('all');
  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('IN');
  const [filter, setFilter] = useState<DiscoveryFilter>('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Title[]>([]);
  const [featuredTitles, setFeaturedTitles] = useState<Title[]>([]);
  const [mobileFeaturedIndex, setMobileFeaturedIndex] = useState(0);
  const [mobileTouchStartX, setMobileTouchStartX] = useState<number | null>(null);

  // Automatically advance the coverflow after 2 seconds without touch input.
  useEffect(() => {
    if (featuredTitles.length < 2 || mobileTouchStartX !== null) return;

    const timer = window.setTimeout(() => {
      setMobileFeaturedIndex(current => (current + 1) % featuredTitles.length);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [featuredTitles.length, mobileFeaturedIndex, mobileTouchStartX]);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Title | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuDrawerRef = useRef<HTMLElement>(null);
  const [availability, setAvailability] = useState<Availability>('all');
  const [genre, setGenre] = useState('');
  const [provider, setProvider] = useState('');
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [wishlist, setWishlist] = useState<Title[]>([]);
  const [wishlistReady, setWishlistReady] = useState(false);

  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem('reelradar-timeliner-open-title');
      if (!pending) return;
      window.sessionStorage.removeItem('reelradar-timeliner-open-title');
      const title = normalizeTitle(JSON.parse(pending));
      if (title) setSelected(title);
    } catch { /* Ignore an invalid one-time Timeliner handoff. */ }
  }, []);

  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem('reelradar-actorlens-open-title');
      if (!pending) return;
      window.sessionStorage.removeItem('reelradar-actorlens-open-title');
      const title = normalizeTitle(JSON.parse(pending));
      if (title) setSelected(title);
    } catch { /* Ignore an invalid one-time ActorLens handoff. */ }
  }, []);

  useEffect(() => {
    let active = true;
    setProvider('');
    fetch(`/api/discover?providers=1&region=${encodeURIComponent(region)}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load streaming platforms');
        const data = await response.json();
        if (active) setPlatforms(Array.isArray(data.providers) ? data.providers : []);
      })
      .catch(() => { if (active) setPlatforms([]); });
    return () => { active = false; };
  }, [region]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      type: 'all', language: '', region, query: '', filter: 'Trending Now',
      page: '1', availability: 'all', genre: '', provider: ''
    });
    fetch(`/api/discover?${params.toString()}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load trending titles');
        const data = await response.json();
        const trending = Array.isArray(data.results)
          ? data.results.map(normalizeTitle).filter((item: Title | null): item is Title => item !== null)
          : [];
        if (active) { setFeaturedTitles(trending.slice(0, 7)); setMobileFeaturedIndex(0); }
      })
      .catch(() => { if (active) setFeaturedTitles([]); });
    return () => { active = false; };
  }, [region]);

  const [showWishlist, setShowWishlist] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWishlist(parsed.map(normalizeTitle).filter((x): x is Title => x !== null));
        }
      }
    } catch {
      setWishlist([]);
    } finally {
      setWishlistReady(true);
    }
  }, []);

  useEffect(() => {
    if (wishlistReady) {
      try { window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist)); }
      catch { /* Wishlist remains available for this session if storage is unavailable. */ }
    }
  }, [wishlist, wishlistReady]);

  const toggleWishlist = (item: Title) => {
    setWishlist(current => current.some(saved => saved.id === item.id && saved.mediaType === item.mediaType)
      ? current.filter(saved => !(saved.id === item.id && saved.mediaType === item.mediaType))
      : [item, ...current]);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: mode, language, region, query: search, filter, page: String(page), availability, genre, provider });
      const res = await fetch(`/api/discover?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load titles.');
      const safeItems: Title[] = Array.isArray(data.results)
  ? (data.results as unknown[])
      .map(normalizeTitle)
      .filter((x: Title | null): x is Title => x !== null)
  : [];
      setItems(safeItems);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setTotalResults(Math.max(0, Number(data.totalResults) || safeItems.length));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setItems([]);
    } finally { setLoading(false); }
  }, [mode, language, region, search, filter, page, availability, genre, provider]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!loading && showSplash) {
      const timer = window.setTimeout(() => setShowSplash(false), 1000);
      return () => window.clearTimeout(timer);
    }
  }, [loading, showSplash]);
  const submitSearch = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setSearch(query.trim()); setPage(1); };
  const menuItems = [
    { key: 'all', label: 'Discover', action: () => { setMode('all'); setSearch(''); setQuery(''); setGenre(''); setPage(1); } },
    { key: 'wishlist', label: 'My Watchlist', action: () => { setShowWishlist(true); setPage(1); window.setTimeout(() => document.querySelector('.catalog-section')?.scrollIntoView({ behavior: 'smooth' }), 0); } },
    { key: 'collide', label: 'Movie Collide', action: () => { window.location.assign('/collide'); } },
    { key: 'roulette', label: 'Movie Roulette', action: () => { window.location.assign('/roulette'); } },
    { key: 'timeliner', label: 'Timeliner', action: () => { window.location.assign('/timeliner'); } },
    { key: 'vibeflix', label: 'VibeFlix', action: () => { window.location.assign('/vibeflix'); } },
    { key: 'bingeclock', label: 'BingeClock', action: () => { window.location.assign('/bingeclock'); } },
    { key: 'actorlens', label: 'ActorLens', action: () => { window.location.assign('/actorlens'); } },
  ];

  useEffect(() => {
    if (!mobileMenu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFirst = window.requestAnimationFrame(() => {
      menuDrawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(false);
        menuTriggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !menuDrawerRef.current) return;
      const focusable = Array.from(menuDrawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirst);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      menuTriggerRef.current?.focus();
    };
  }, [mobileMenu]);
  const regionLabel = COUNTRIES.find(c => c.code === region)?.label ?? region;
  const availableGenres = mode === 'movie' ? MOVIE_GENRES : mode === 'tv' ? TV_GENRES : SHARED_GENRES;
  const displayedItems = showWishlist ? wishlist : items;
  const moveFeatured = (direction: number) => {
    if (featuredTitles.length < 2) return;
    setMobileFeaturedIndex(current =>
      (current + direction + featuredTitles.length) % featuredTitles.length
    );
  };
  const visibleFeaturedOffsets = [0, -1, 1, -2, 2]
    .filter((offset, index, offsets) => {
      const itemIndex = (mobileFeaturedIndex + offset + featuredTitles.length) % featuredTitles.length;
      return offsets.findIndex(candidate =>
        (mobileFeaturedIndex + candidate + featuredTitles.length) % featuredTitles.length === itemIndex
      ) === index;
    })
    .sort((a, b) => a - b);

  return <main className="site-shell">
    {showSplash && <div
      className="splash-screen"
      role="status"
      aria-label="Loading REELRADAR"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#08090d',
      }}
    >
      <div className="splash-brand-mark"><Clapperboard size={38} strokeWidth={1.7} /></div>
      <div className="splash-wordmark">REEL<span>RADAR</span></div>
      <div className="splash-loader"><span /></div>
      <p>PREPARING YOUR NEXT WATCH</p>
    </div>}
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark"><Radio size={19} /></span><span>REEL<span>RADAR</span></span><i /></a>
      <nav className="desktop-nav" aria-label="Main navigation">{menuItems.map(item => <button key={item.key} className={(item.key === 'vibeflix' ? pathname === '/vibeflix' : item.key === 'bingeclock' ? pathname === '/bingeclock' : item.key === 'actorlens' ? pathname.startsWith('/actorlens') : item.key === 'wishlist' ? showWishlist : mode === item.key) ? 'nav-active' : ''} onClick={item.action} type="button">{item.label}</button>)}</nav>
      <div className="header-actions"><label className="region-select"><Globe2 size={15} />
        <select value={region} onChange={e => { setRegion(e.target.value); setPage(1); }} aria-label="Streaming country">
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select><ChevronDown size={13} /></label>
        <button ref={menuTriggerRef} className="mobile-menu-button" onClick={() => setMobileMenu(open => !open)} aria-label={mobileMenu ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenu} aria-controls="mobile-navigation-drawer" type="button"><Menu /></button>
      </div>
    </header>
    <button className={`mobile-drawer-overlay ${mobileMenu ? 'is-open' : ''}`} type="button" aria-label="Close navigation menu" tabIndex={mobileMenu ? 0 : -1} onClick={() => setMobileMenu(false)} />
    <aside ref={menuDrawerRef} id="mobile-navigation-drawer" className={`mobile-navigation-drawer ${mobileMenu ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Navigation menu" aria-hidden={!mobileMenu}>
      <div className="mobile-drawer-header"><span>MENU</span><button type="button" className="mobile-drawer-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={20} /></button></div>
     <nav className="mobile-drawer-links" aria-label="Main navigation">
  {menuItems.map(item => (
    <button
      key={item.key}
      className={(item.key === 'vibeflix' ? pathname === '/vibeflix' : item.key === 'bingeclock' ? pathname === '/bingeclock' : item.key === 'actorlens' ? pathname.startsWith('/actorlens') : item.key === 'wishlist' ? showWishlist : mode === item.key) ? 'nav-active' : ''}
      onClick={() => {
        setMobileMenu(false);
        if (item.key === 'bingeclock' || item.key === 'actorlens') window.setTimeout(item.action, 180);
        else item.action();
      }}
      type="button"
    >
      {item.key === 'all' && <Compass size={17} />}
      {item.key === 'wishlist' && <Heart size={17} />}
      {item.key === 'collide' && <GitMerge size={17} />}
      {item.key === 'roulette' && <Dices size={17} />}
      {item.key === 'timeliner' && <Clock3 size={17} />}
      {item.key === 'vibeflix' && <Sparkles size={17} />}
      {item.key === 'bingeclock' && <Hourglass size={17} />}
      {item.key === 'actorlens' && <ScanEye size={17} />}
      {item.label}
    </button>
  ))}
</nav>
    </aside>
    <section className="intro rr-showcase-intro" id="top">
      <div className="intro-orb orb-one" /><div className="intro-orb orb-two" />
      <div className="intro-content rr-showcase-content">
        <div className="rr-showcase-heading">
          <div>
            <h1 className="rr-showcase-title">TRENDING NOW</h1>
          </div>
        </div>
        <div
          className="rr-featured-rail"
          aria-label="Popular movies and series. Swipe to explore."
          onTouchStart={event => setMobileTouchStartX(event.touches[0].clientX)}
          onTouchEnd={event => {
            if (mobileTouchStartX === null) return;
            const delta = event.changedTouches[0].clientX - mobileTouchStartX;
            if (Math.abs(delta) > 35) moveFeatured(delta < 0 ? 1 : -1);
            setMobileTouchStartX(null);
          }}
        >
          {featuredTitles.length ? visibleFeaturedOffsets.map(offset => {
            const itemIndex = (mobileFeaturedIndex + offset + featuredTitles.length) % featuredTitles.length;
            const item = featuredTitles[itemIndex];
            const isWishlisted = wishlist.some(saved => saved.id === item.id && saved.mediaType === item.mediaType);
            return <div
              className={`rr-featured-card rr-featured-card-${offset + 2} rr-featured-cover-card rr-cover-position-${offset + 2}`}
              key={`${item.mediaType}-${item.id}`}
              role="button"
              tabIndex={offset === 0 ? 0 : -1}
              aria-hidden={offset !== 0}
              onClick={() => {
                if (offset === 0) setSelected(item);
                else moveFeatured(offset);
              }}
              onKeyDown={event => {
                if (offset === 0 && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  setSelected(item);
                } else if (offset === 0 && event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveFeatured(-1);
                } else if (offset === 0 && event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveFeatured(1);
                }
              }}
              aria-label={`${item.title}${offset === 0 ? ', selected title' : ', move to center'}`}
            >
              <span className="rr-featured-image">
                {item.poster || item.backdrop
                  ? <img src={item.poster || item.backdrop || ''} alt="" loading={offset === 0 ? 'eager' : 'lazy'} decoding="async" />
                  : <span className="rr-featured-fallback"><Film size={30} /></span>}
              </span>
              <span className="rr-featured-shade" />
              <span className="rr-featured-glass" />
              <span className="rr-featured-topline">
                <span>{item.mediaType === 'tv' ? 'SERIES' : 'MOVIE'}</span>
                {item.rating !== null && <span><Star size={11} fill="currentColor" /> IMDb {item.rating.toFixed(1)}</span>}
              </span>
              <span className="rr-featured-copy">
                <strong>{item.title}</strong>
                <small>{item.year || 'Coming soon'} <span>·</span> {getLanguageLabel(item.language)}</small>
                <span className="rr-featured-actions">
                  <button type="button" className="rr-read-more" onClick={event => { event.stopPropagation(); setSelected(item); }}>READ MORE <ArrowUpRight size={13} /></button>
                  <button type="button" className={`rr-featured-wishlist ${isWishlisted ? 'is-saved' : ''}`} aria-label={isWishlisted ? `Remove ${item.title} from wishlist` : `Add ${item.title} to wishlist`} onClick={event => { event.stopPropagation(); toggleWishlist(item); }}><Heart size={19} fill={isWishlisted ? 'currentColor' : 'none'} /></button>
                </span>
              </span>
            </div>;
          }) : <div className="rr-featured-card rr-featured-skeleton" />}
        </div>
        <form className="searchbar" onSubmit={submitSearch}>
          <Search size={19} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search movies, series, documentaries…" />
          <button type="submit">Explore <ArrowUpRight size={15} /></button>
        </form>
        <div className="media-type-toggle-wrap">
          <div className="availability-toggle media-type-toggle" role="group" aria-label="Content type filter">
            {([['movie', 'MOVIES'], ['tv', 'SERIES'], ['documentary', 'DOCUMENTARIES']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={mode === value ? 'availability-active' : ''}
                aria-pressed={mode === value}
                onClick={() => { setMode(value); setSearch(''); setQuery(''); setGenre(''); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="intro-foot"><span><span className="live-dot" /> FRESH RELEASES</span><span>11 LANGUAGES</span><span>ONE DISCOVERY SPACE</span></div>
      </div>
      <style jsx global>{`
        .mobile-menu-button { display:none; }
        .mobile-drawer-overlay { display:none; }
        .mobile-navigation-drawer { display:none; }
        @media (max-width:768px) {
          .desktop-nav { display:none !important; }
          .mobile-menu-button { display:grid !important; place-items:center; background:transparent; border:0; color:#e5e8e1; padding:6px; }
          .mobile-drawer-overlay { display:block; position:fixed; inset:0; z-index:100; border:0; padding:0; background:rgba(0,0,0,.68); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .28s ease,visibility .28s ease; }
          .mobile-drawer-overlay.is-open { opacity:1; visibility:visible; pointer-events:auto; }
          .mobile-navigation-drawer { display:flex; position:fixed; z-index:101; top:0; right:0; bottom:0; width:min( min(86vw, 360px), 100% ); flex-direction:column; padding:24px 22px; background:linear-gradient(155deg,#171a20,#0b0d12 72%); border-left:1px solid rgba(223,255,0,.2); box-shadow:-24px 0 70px rgba(0,0,0,.5); transform:translateX(105%); visibility:hidden; transition:transform .3s cubic-bezier(.2,.75,.25,1),visibility .3s ease; }
          .mobile-navigation-drawer.is-open { transform:translateX(0); visibility:visible; }
          .mobile-drawer-header { display:flex; align-items:center; justify-content:space-between; padding-bottom:22px; border-bottom:1px solid rgba(255,255,255,.1); color:#DFFF00; font-size:11px; font-weight:800; letter-spacing:.22em; }
          .mobile-drawer-close { display:grid; place-items:center; width:40px; height:40px; border:1px solid rgba(255,255,255,.14); border-radius:12px; color:#fff; background:rgba(255,255,255,.06); }
          .mobile-drawer-links { display:flex; flex-direction:column; gap:8px; padding-top:24px; }
          .mobile-drawer-links button { display:flex; align-items:center; gap:12px; width:100%; min-height:52px; padding:0 14px; border:1px solid transparent; border-radius:10px; background:transparent; color:#aeb3bf; text-align:left; font-size:15px; font-weight:650; }
          .mobile-drawer-links button:hover,.mobile-drawer-links button:focus-visible,.mobile-drawer-links button.nav-active { color:#fff; border-color:rgba(223,255,0,.22); background:rgba(223,255,0,.07); outline:none; }
          .mobile-drawer-links button.nav-active { box-shadow:inset 3px 0 #DFFF00; }
        }
        @media (prefers-reduced-motion:reduce) { .mobile-drawer-overlay,.mobile-navigation-drawer { transition:none !important; } }

        /* Desktop-only layout polish: distribute discovery controls across the feed. */
        @media (min-width: 1100px) {
          .rr-showcase-heading {
            justify-content: center !important;
            text-align: center !important;
            margin-bottom: 22px !important;
          }
          .rr-showcase-heading > div {
            width: 100%;
            text-align: center !important;
          }
          .rr-showcase-title {
            text-align: center;
          }
          .rr-showcase-content :global(.searchbar) {
            width: min(100%, 900px) !important;
            margin: 5px auto 0 !important;
          }
          .rr-showcase-content :global(.intro-foot) {
            width: min(100%, 900px);
            margin: 24px auto 0 !important;
            justify-content: center !important;
          }
          .catalog-section {
            width: min(100% - 10vw, 1700px);
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .catalog-section .filter-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 24px;
          }
          .catalog-section .language-filters {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 9px;
            min-width: 0;
          }
          .catalog-section .desktop-discovery-controls {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(280px, 1.05fr);
            align-items: end;
            gap: 24px;
            width: 100%;
            margin: 28px 0 26px;
          }
          .catalog-section .catalog-controls,
          .catalog-section .discovery-filter-wrap {
            display: flex;
            box-sizing: border-box;
            width: 100%;
            min-width: 0;
            margin: 0;
          }
          .catalog-section .catalog-controls {
            grid-column: 4;
            grid-row: 1;
            align-items: center;
            justify-content: flex-end;
          }
          .catalog-section .availability-toggle {
            width: 100%;
            max-width: 360px;
          }
          .catalog-section .availability-toggle button {
            flex: 1;
          }
          .catalog-section .discovery-filter-wrap {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .catalog-section .desktop-discovery-controls > .discovery-filter-wrap:nth-child(2) { grid-column: 1; grid-row: 1; }
          .catalog-section .desktop-discovery-controls > .discovery-filter-wrap:nth-child(3) { grid-column: 2; grid-row: 1; }
          .catalog-section .desktop-discovery-controls > .discovery-filter-wrap:nth-child(4) { grid-column: 3; grid-row: 1; }
          .catalog-section .discovery-filter-wrap label {
            white-space: nowrap;
          }
          .catalog-section .discovery-filter-select {
            width: 100%;
            min-width: 0;
          }
          .catalog-section .discovery-filter-wrap:last-of-type {
            margin-right: 0;
          }
        }
      `}</style>
      <style jsx>{`
        .rr-showcase-intro { display:block; position:relative; overflow:hidden; padding:52px max(5vw, 24px) 38px; }
        .rr-showcase-content { position:relative; z-index:1; width:100%; max-width:1500px; margin:0 auto; }
        .rr-showcase-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:22px; }
        .rr-showcase-title { margin:14px 0 5px; font-size:clamp(28px,3.4vw,44px); line-height:1.02; letter-spacing:.04em; font-weight:850; color:#DFFF00; }
        .rr-live-label { display:flex; align-items:center; gap:9px; padding:9px 12px; border:1px solid rgba(223,255,0,.18); border-radius:999px; color:#cbd0d8; font-size:10px; letter-spacing:.16em; white-space:nowrap; }
        .rr-featured-rail {
          position:relative; display:flex; align-items:center; justify-content:center;
          width:100%; height:clamp(360px,36vw,500px); margin:0 auto 18px;
          overflow:hidden; perspective:1500px; transform-style:preserve-3d;
          touch-action:pan-y; isolation:isolate;
        }
        .rr-featured-card {
          position:absolute; left:50%; top:50%; width:clamp(230px,25vw,340px);
          height:clamp(300px,32vw,430px); min-width:0; overflow:hidden;
          border:1px solid rgba(255,255,255,.2); border-radius:22px; padding:0;
          text-align:left; color:#fff; background:rgba(255,255,255,.055);
          box-shadow:0 24px 65px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16);
          transform-origin:center center; cursor:pointer; backdrop-filter:blur(18px);
          -webkit-backdrop-filter:blur(18px);
          transition:transform .72s cubic-bezier(.22,1,.36,1), opacity .55s ease,
            filter .55s ease, box-shadow .55s ease, border-color .55s ease;
          will-change:transform,opacity,filter;
        }
        .rr-cover-position-2 { z-index:5; transform:translate(-50%,-50%) translateX(0) rotateY(0) scale(1); opacity:1; filter:none; border-color:rgba(223,255,0,.48); box-shadow:0 32px 80px rgba(0,0,0,.68),0 0 32px rgba(223,255,0,.09),inset 0 1px 0 rgba(255,255,255,.2); }
        .rr-cover-position-1 { z-index:4; transform:translate(-50%,-50%) translateX(-74%) rotateY(32deg) scale(.78); opacity:.72; filter:brightness(.62) saturate(.75); }
        .rr-cover-position-3 { z-index:4; transform:translate(-50%,-50%) translateX(74%) rotateY(-32deg) scale(.78); opacity:.72; filter:brightness(.62) saturate(.75); }
        .rr-cover-position-0 { z-index:2; transform:translate(-50%,-50%) translateX(-118%) rotateY(42deg) scale(.62); opacity:.32; filter:brightness(.38) saturate(.55); }
        .rr-cover-position-4 { z-index:2; transform:translate(-50%,-50%) translateX(118%) rotateY(-42deg) scale(.62); opacity:.32; filter:brightness(.38) saturate(.55); }
        .rr-featured-card:hover,.rr-featured-card:focus-visible { border-color:rgba(223,255,0,.65); outline:none; }
        .rr-cover-position-2:hover,.rr-cover-position-2:focus-visible { box-shadow:0 36px 88px rgba(0,0,0,.72),0 0 34px rgba(223,255,0,.13); }
        .rr-featured-image,.rr-featured-image img,.rr-featured-fallback { position:absolute; inset:0; width:100%; height:100%; }
        .rr-featured-image img { object-fit:cover; transition:transform .55s ease; }
        .rr-featured-card:hover .rr-featured-image img { transform:scale(1.07); }
        .rr-featured-fallback { display:grid; place-items:center; color:#DFFF00; background:linear-gradient(135deg,#22252c,#090a0d); }
        .rr-featured-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(5,6,9,.12),rgba(5,6,9,.08) 36%,rgba(5,6,9,.94)); }
        .rr-featured-glass { position:absolute; inset:0; pointer-events:none; border-radius:inherit; background:linear-gradient(135deg,rgba(255,255,255,.22),transparent 28%,rgba(255,255,255,.025) 62%,rgba(223,255,0,.08)); box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 0 35px rgba(255,255,255,.035); }
        .rr-featured-topline { position:absolute; top:13px; left:13px; right:13px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .rr-featured-topline span { display:inline-flex; align-items:center; gap:4px; padding:6px 8px; border:1px solid rgba(255,255,255,.17); border-radius:7px; background:rgba(8,9,13,.72); backdrop-filter:blur(12px); font-size:9px; font-weight:800; letter-spacing:.1em; }
        @media (max-width:760px) { .rr-featured-topline span { backdrop-filter:none; -webkit-backdrop-filter:none; } }
        .rr-featured-topline span:last-child { color:#DFFF00; }
        .rr-featured-copy { position:absolute; left:15px; right:15px; bottom:15px; display:flex; flex-direction:column; gap:7px; }
        .rr-featured-actions { display:none; }
        .rr-featured-copy strong { font-size:clamp(14px,1.25vw,19px); line-height:1.15; font-weight:800; text-shadow:0 2px 12px #000; }
        .rr-featured-copy small { display:flex; align-items:center; gap:6px; color:#c4c8d0; font-size:9px; letter-spacing:.11em; }
        .rr-featured-copy small svg { color:#DFFF00; }
        .rr-featured-skeleton { pointer-events:none; background:linear-gradient(110deg,rgba(255,255,255,.04) 8%,rgba(255,255,255,.1) 18%,rgba(255,255,255,.04) 33%); background-size:200% 100%; animation:rr-shimmer 1.5s linear infinite; }
        @keyframes rr-shimmer { to { background-position-x:-200%; } }
        .rr-showcase-content :global(.searchbar) { width:min(100%,720px); margin-top:5px; }
        .media-type-toggle-wrap { display:flex; justify-content:center; width:100%; margin:14px auto 0; }
        .media-type-toggle { width:min(100%,440px); }
        .media-type-toggle button { flex:1; white-space:nowrap; }
        @media (max-width:760px) {
          .rr-showcase-intro { padding:34px 16px 28px; }
          .rr-showcase-heading { align-items:center; justify-content:center; text-align:center; margin-bottom:12px; }
          .rr-showcase-heading > div { width:100%; text-align:center; }
          .rr-showcase-title { margin:0; font-size:23px; letter-spacing:.12em; }
          .rr-live-label { padding:7px 9px; font-size:8px; }
          .rr-featured-rail { height:calc(100vw * 1.08); max-height:440px; min-height:350px; margin:0 -16px 12px; width:calc(100% + 32px); }
          .rr-featured-card { width:min(67vw,310px); height:auto; aspect-ratio:3 / 4; border-radius:22px; backdrop-filter:none; -webkit-backdrop-filter:none; }
          .rr-cover-position-1 { transform:translate(-50%,-50%) translateX(-67%) rotateY(35deg) scale(.76); opacity:.68; }
          .rr-cover-position-3 { transform:translate(-50%,-50%) translateX(67%) rotateY(-35deg) scale(.76); opacity:.68; }
          .rr-cover-position-0 { transform:translate(-50%,-50%) translateX(-105%) rotateY(45deg) scale(.58); opacity:.2; }
          .rr-cover-position-4 { transform:translate(-50%,-50%) translateX(105%) rotateY(-45deg) scale(.58); opacity:.2; }
          .rr-featured-copy { left:16px; right:16px; bottom:16px; gap:8px; }
          .rr-featured-copy strong { font-size:clamp(20px,6vw,27px); line-height:1.05; }
          .rr-featured-copy small { font-size:11px; letter-spacing:.02em; }
          .rr-featured-actions { display:flex; align-items:center; gap:10px; margin-top:5px; }
          .rr-read-more,.rr-featured-wishlist { display:inline-flex; align-items:center; justify-content:center; min-height:46px; border:1px solid rgba(255,255,255,.25); border-radius:13px; color:#fff; background:rgba(255,255,255,.13); box-shadow:inset 0 1px 0 rgba(255,255,255,.2); cursor:pointer; }
          .rr-read-more { flex:1; gap:8px; font-size:13px; font-weight:800; letter-spacing:.08em; }
          .rr-read-more svg { color:#DFFF00; }
          .rr-featured-wishlist { width:52px; color:#fff; }
          .rr-featured-wishlist.is-saved { color:#DFFF00; border-color:rgba(223,255,0,.55); }
          .rr-featured-glass { background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 30%,rgba(255,255,255,.025) 70%); }
          .rr-showcase-content :global(.searchbar) { margin-top:0; }
        }
        @media (prefers-reduced-motion:reduce) { .rr-featured-card,.rr-featured-image img { transition:none !important; animation:none !important; } }




      `}</style>
    </section>
    <section className="catalog-section">
      <div className="section-heading"><div><div className="eyebrow">THE DISCOVERY FEED</div>
        <h2>{search ? `Results for “${search}”` : filter || 'All picks'}</h2>
        <p>Explore titles by mood and popularity. Streaming availability depends on your region.</p></div>
        <div className="result-count"><SlidersHorizontal size={15} /><span>{totalResults.toLocaleString()} TITLES</span></div>
      </div>

      <div className="filter-row">
        <div className="language-filters">
          <button className={!language ? 'filter-chip selected' : 'filter-chip'} onClick={() => { setLanguage(''); setPage(1); }} type="button">All languages</button>
          {LANGUAGES.map(l => <button key={l.code} className={language === l.code ? 'filter-chip selected' : 'filter-chip'} onClick={() => setLanguage(current => current === l.code ? '' : l.code)} type="button">{l.label}</button>)}
        </div>
        <div className="region-note"><Globe2 size={13} /> {regionLabel}</div>
      </div>
      <div className="desktop-discovery-controls">
        <div className="catalog-controls">
          <div className="availability-toggle" role="group" aria-label="Availability filter">
            {([['ott', 'OTT'], ['all', 'ALL'], ['theatre', 'THEATRE']] as const).map(([value, label]) =>
              <button key={value} type="button" className={availability === value ? 'availability-active' : ''} onClick={() => { setAvailability(value); setPage(1); }}>{label}</button>
            )}
          </div>
        </div>
        <div className="discovery-filter-wrap">
        <label htmlFor="discovery-filter">Browse by</label>
        <select id="discovery-filter" className="discovery-filter-select" value={filter} onChange={e => { setFilter(e.target.value as DiscoveryFilter); setPage(1); }}>
          <option value="">All picks</option>
          {DISCOVERY_FILTERS.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div className="discovery-filter-wrap">
        <label htmlFor="genre-filter">Genre</label>
        <select id="genre-filter" className="discovery-filter-select" value={genre} disabled={mode === 'documentary'}
          onChange={e => { setGenre(e.target.value); setPage(1); setShowWishlist(false); }}>
          <option value="">{mode === 'documentary' ? 'Documentaries only' : 'All genres'}</option>
          {availableGenres.slice(0, 8).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </div>
        <div className="discovery-filter-wrap">
          <label htmlFor="platform-filter">Streaming platform</label>
          <select id="platform-filter" className="discovery-filter-select" value={provider}
            onChange={e => { setProvider(e.target.value); setPage(1); setShowWishlist(false); }}>
            <option value="">All available platforms</option>
            {platforms.map(platform => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
          </select>
        </div>
      </div>
      {showWishlist ? (displayedItems.length === 0
        ? <div className="empty-state"><div className="empty-icon"><Heart size={25} /></div><h3>Your wishlist is empty</h3><p>Save movies and series with the heart button. Your list stays on this device and does not require an account.</p><button className="retry-button" onClick={() => setShowWishlist(false)} type="button">Explore titles</button></div>
        : <div className="poster-grid">{displayedItems.map(item => <Poster key={`${item.mediaType}-${item.id}`} item={item} onOpen={setSelected} />)}</div>)
        : loading ? <div className="loading-grid">{Array.from({ length: 10 }).map((_, i) => <div className="skeleton" key={i} />)}</div>
        : error ? <div className="empty-state"><div className="empty-icon"><Radio size={25} /></div><h3>Could not load titles</h3><p>{error}</p>
          <span>Check the TMDB environment variables and deployment logs.</span><button className="retry-button" onClick={() => void load()} type="button">Try again</button></div>
        : displayedItems.length === 0 ? <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><h3>No titles found</h3><p>Try another language, filter or search term.</p>
          <button className="retry-button" onClick={() => { setLanguage(''); setSearch(''); setQuery(''); setFilter(''); setMode('all'); setAvailability('all'); setGenre(''); setProvider(''); setShowWishlist(false); setPage(1); }} type="button">Clear filters</button></div>
        : <><div className="poster-grid">{displayedItems.map(item => <Poster key={`${item.mediaType}-${item.id}`} item={item} onOpen={setSelected} />)}</div>
          <div className="pagination-wrap" aria-label="Pagination">
            <button type="button" disabled={page <= 1 || loading} onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: document.querySelector('.catalog-section')?.getBoundingClientRect().top ?? 0, behavior: 'smooth' }); }}>Previous</button>
            <div className="pagination-pages">
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                const start = Math.max(1, Math.min(totalPages - 4, page - 2));
                const pageNumber = start + index;
                return <button key={pageNumber} type="button" className={pageNumber === page ? 'page-number page-current' : 'page-number'} disabled={loading} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>;
              })}
            </div>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: document.querySelector('.catalog-section')?.getBoundingClientRect().top ?? 0, behavior: 'smooth' }); }}>Next <ArrowUpRight size={13} /></button>
          </div>
          <div className="feed-footer"><span>SHOWING {items.length} OF {totalResults.toLocaleString()} TITLES</span><span>UPDATED LIVE FROM TMDB <span className="live-dot" /></span></div></>}
    </section>

    <footer className="footer"><a className="brand" href="/"><span className="brand-mark"><Radio size={17} /></span><span>REEL<span>RADAR</span></span></a>
      <p>One place for everything worth watching.</p><span className="footer-credit">MOVIE DATA &amp; IMAGES BY TMDB · NOT AN OFFICIAL TMDB PRODUCT</span></footer>
    {selected && <DetailModal item={selected} close={() => setSelected(null)} region={region} isWishlisted={wishlist.some(saved => saved.id === selected.id && saved.mediaType === selected.mediaType)} onToggleWishlist={toggleWishlist} />}
  </main>;
}
