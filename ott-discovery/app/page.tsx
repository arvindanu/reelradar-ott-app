'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, SlidersHorizontal, Play, Star, ArrowUpRight, Film, Clapperboard, Globe2, Sparkles, ChevronDown, X, Menu, Radio, ExternalLink } from 'lucide-react';
import { COUNTRIES, LANGUAGES } from '@/lib/catalog';

type Provider = { id: number; name: string; logo: string | null };
type Title = {
  id: number; mediaType: 'movie' | 'tv'; title: string; overview: string;
  poster: string | null; backdrop: string | null; releaseDate: string;
  year: string; rating: number | null; language: string; genres: number[];
  trailerKey: string | null; trailerThumb: string | null;
  providers: Provider[]; watchLink: string | null;
};
type Mode = 'all' | 'movie' | 'tv' | 'documentary';

const LANG_LABEL: Record<string, string> = Object.fromEntries(LANGUAGES.map(x => [x.code, x.label]));
const getLanguageLabel = (language?: string | null) =>
  !language ? 'Unknown language' : (LANG_LABEL[language] ?? language.toUpperCase());

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
    providers: Array.isArray(x.providers) ? x.providers : [],
    watchLink: x.watchLink ?? null,
  };
}

function Poster({ item, onOpen }: { item: Title; onOpen: (x: Title) => void }) {
  const trailerUrl = item.trailerKey
    ? `https://www.youtube.com/watch?v=${item.trailerKey}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' official trailer')}`;
  return <article className="poster-card" onClick={() => onOpen(item)} tabIndex={0}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item); } }}>
    <div className="poster-art">
      {item.poster ? <img src={item.poster} alt={`${item.title} poster`} loading="lazy" />
        : <div className="poster-fallback"><Film size={30} /><span>{item.title}</span></div>}
      <div className="poster-shade" />
      <div className="poster-topline">
        <span className="type-pill">{item.mediaType === 'tv' ? 'SERIES' : 'FILM'}</span>
        {item.rating !== null && <span className="rating"><Star size={11} fill="currentColor" /> {item.rating.toFixed(1)}</span>}
      </div>
      <button className="quick-play" type="button" aria-label={`View ${item.title}`}
        onClick={e => { e.stopPropagation(); onOpen(item); }}><Play size={16} fill="currentColor" /></button>
      <div className="poster-info"><h3>{item.title}</h3><p>{item.year || 'New release'} <span>·</span> {getLanguageLabel(item.language)}</p></div>
    </div>
    <a className="card-trailer" href={trailerUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
      <span className="trailer-thumb">{item.trailerThumb ? <img src={item.trailerThumb} alt="" loading="lazy" /> : <Play size={12} />}<Play size={9} fill="currentColor" /></span>
      <span>WATCH TRAILER</span><ArrowUpRight size={12} />
    </a>
    <div className="card-meta"><div className="provider-stack">
      {item.providers.length ? item.providers.slice(0, 3).map(p => p.logo
        ? <img key={p.id} src={p.logo} alt={p.name} title={p.name} />
        : <span key={p.id} title={p.name}>{p.name.slice(0, 1)}</span>)
        : <span className="provider-empty">No OTT data</span>}
    </div><span className="card-arrow"><ArrowUpRight size={15} /></span></div>
  </article>;
}

function DetailModal({ item, close }: { item: Title; close: () => void }) {
  const trailer = item.trailerKey
    ? `https://www.youtube.com/watch?v=${item.trailerKey}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + ' official trailer')}`;
  return <div className="modal-backdrop" onMouseDown={close}>
    <section className="detail-modal" onMouseDown={e => e.stopPropagation()}>
      <button className="modal-close" onClick={close} aria-label="Close" type="button"><X size={18} /></button>
      <div className="modal-hero" style={item.backdrop ? { backgroundImage: `linear-gradient(90deg,rgba(8,9,13,.98),rgba(8,9,13,.58)),url(${item.backdrop})` } : {}}>
        <div className="modal-copy">
          <span className="eyebrow">{item.mediaType === 'tv' ? 'SERIES' : 'MOVIE'} · {item.year}</span>
          <h2>{item.title}</h2>
          <div className="modal-stats">
            {item.rating !== null && <span><Star size={14} fill="currentColor" /> {item.rating.toFixed(1)} / 10</span>}
            <span>{getLanguageLabel(item.language)}</span>
          </div>
          <p>{item.overview || 'Synopsis not available yet.'}</p>
          <a className="primary-cta" href={trailer} target="_blank" rel="noreferrer"><Play size={15} fill="currentColor" /> Watch trailer on YouTube <ExternalLink size={14} /></a>
        </div>
      </div>
      <div className="modal-bottom"><div><span className="eyebrow">WHERE TO WATCH</span><h3>Available on your platforms</h3></div>
        {item.watchLink && <a className="provider-link" href={item.watchLink} target="_blank" rel="noreferrer">All options <ArrowUpRight size={14} /></a>}
      </div>
      {item.providers.length ? <div className="modal-providers">{item.providers.map(p =>
        <div className="modal-provider" key={p.id}>{p.logo && <img src={p.logo} alt="" />}<span>{p.name}</span></div>)}</div>
        : <p className="no-provider">No streaming availability was returned for this country. Try changing your region.</p>}
      {item.trailerThumb && <a className="trailer-preview" href={trailer} target="_blank" rel="noreferrer">
        <img src={item.trailerThumb} alt="Trailer thumbnail" /><span className="trailer-play"><Play fill="currentColor" /></span><span>PLAY OFFICIAL TRAILER</span>
      </a>}
    </section>
  </div>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('all');
  const [language, setLanguage] = useState('');
  const [region, setRegion] = useState('IN');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Title | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: mode, language, region, query: search });
      const res = await fetch(`/api/discover?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load titles.');
      const safeItems = Array.isArray(data.results)
        ? data.results.map(normalizeTitle).filter((x: Title | null): x is Title => x !== null)
: [];
      setItems(safeItems);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setItems([]);
    } finally { setLoading(false); }
  }, [mode, language, region, search]);

  useEffect(() => { void load(); }, [load]);

  const submitSearch = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); setSearch(query.trim()); };
  const tabs: [Mode, string][] = [['all', 'Discover'], ['movie', 'Movies'], ['tv', 'Series'], ['documentary', 'Documentaries']];
  const regionLabel = COUNTRIES.find(c => c.code === region)?.label ?? region;

  return <main className="site-shell">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark"><Radio size={19} /></span><span>REEL<span>RADAR</span></span><i /></a>
      <nav className="desktop-nav">{tabs.map(([v, l]) => <button key={v} className={mode === v ? 'nav-active' : ''}
        onClick={() => { setMode(v); setSearch(''); setQuery(''); }} type="button">{l}</button>)}</nav>
      <div className="header-actions"><label className="region-select"><Globe2 size={15} />
        <select value={region} onChange={e => setRegion(e.target.value)} aria-label="Streaming country">
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select><ChevronDown size={13} /></label>
        <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu" type="button"><Menu /></button>
      </div>
    </header>
    {mobileMenu && <nav className="mobile-nav">{tabs.map(([v, l]) => <button key={v} className={mode === v ? 'nav-active' : ''}
      onClick={() => { setMode(v); setMobileMenu(false); }} type="button">{l}</button>)}</nav>}
    <section className="intro" id="top">
      <div className="intro-orb orb-one" /><div className="intro-orb orb-two" />
      <div className="intro-content"><div className="eyebrow intro-kicker"><Sparkles size={13} /> YOUR NEXT OBSESSION STARTS HERE</div>
        <h1>Less scrolling.<br /><span>More watching.</span></h1>
        <p>Every story worth watching, across every language and platform.</p>
        <form className="searchbar" onSubmit={submitSearch}><Search size={19} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search movies, series, documentaries…" />
          <button type="submit">Explore <ArrowUpRight size={15} /></button>
        </form>
        <div className="intro-foot"><span><span className="live-dot" /> FRESH RELEASES</span><span>10 LANGUAGES</span><span>ONE DISCOVERY SPACE</span></div>
      </div>
      <div className="intro-art"><div className="art-orbit orbit-a" /><div className="art-orbit orbit-b" />
        <div className="art-glass"><Clapperboard size={44} /><span>THE WORLD<br />OF STORIES</span><small>CURATED FOR YOU</small></div>
        <div className="floating-chip chip-a">✦ &nbsp; New this week</div><div className="floating-chip chip-b">10 languages</div>
      </div>
    </section>
    <section className="catalog-section">
      <div className="section-heading"><div><div className="eyebrow">THE DISCOVERY FEED</div>
        <h2>{search ? `Results for “${search}”` : mode === 'all' ? 'The latest drop' : mode === 'movie' ? 'Fresh films' : mode === 'tv' ? 'New episodes & series' : 'Documentary spotlight'}</h2>
        <p>Fresh picks, sorted by release date. Availability depends on your region.</p></div>
        <div className="result-count"><SlidersHorizontal size={15} /><span>{items.length} TITLES</span></div>
      </div>
      <div className="filter-row"><div className="language-filters">
        <button className={!language ? 'filter-chip selected' : 'filter-chip'} onClick={() => setLanguage('')} type="button">All languages</button>
        {LANGUAGES.map(l => <button key={l.code} className={language === l.code ? 'filter-chip selected' : 'filter-chip'}
          onClick={() => setLanguage(current => current === l.code ? '' : l.code)} type="button">{l.label}</button>)}
      </div><div className="region-note"><Globe2 size={13} /> {regionLabel}</div></div>
      {loading ? <div className="loading-grid">{Array.from({ length: 10 }).map((_, i) => <div className="skeleton" key={i} />)}</div>
        : error ? <div className="empty-state"><div className="empty-icon"><Radio size={25} /></div><h3>Connect your discovery engine</h3>
          <p>{error}</p><span>Check the TMDB environment variables in Vercel and your deployment logs.</span>
          <button className="retry-button" onClick={() => void load()} type="button">Try again</button></div>
        : items.length === 0 ? <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><h3>No titles found</h3>
          <p>Try another language, category or search term.</p>
          <button className="retry-button" onClick={() => { setLanguage(''); setSearch(''); setQuery(''); setMode('all'); }} type="button">Clear filters</button></div>
        : <><div className="poster-grid">{items.map(item => <Poster key={`${item.mediaType}-${item.id}`} item={item} onOpen={setSelected} />)}</div>
          <div className="feed-footer"><span>YOU'RE ALL CAUGHT UP</span><span>UPDATED LIVE FROM TMDB <span className="live-dot" /></span></div></>}
    </section>
    <footer className="footer"><a className="brand" href="#top"><span className="brand-mark"><Radio size={17} /></span><span>REEL<span>RADAR</span></span></a>
      <p>One place for everything worth watching.</p><span className="footer-credit">MOVIE DATA &amp; IMAGES BY TMDB · NOT AN OFFICIAL TMDB PRODUCT</span></footer>
    {selected && <DetailModal item={selected} close={() => setSelected(null)} />}
  </main>;
}
