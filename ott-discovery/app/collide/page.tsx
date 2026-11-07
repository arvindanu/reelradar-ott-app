'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clapperboard, Film, GitMerge, LoaderCircle, Search, Share2, Star, X } from 'lucide-react';

type Movie = {
  id: number; mediaType: 'movie' | 'tv'; title: string; overview: string;
  poster: string | null; backdrop: string | null; releaseDate: string; year: string;
  rating: number | null; language: string; genres: number[]; trailerKey: string | null;
  trailerThumb: string | null; providers: { id: number; name: string; logo: string | null }[]; watchLink: string | null;
};
type CollisionResult = { match: (Movie & { genreNames?: string[] }) | null; runnersUp: Movie[]; reasonA: string[]; reasonB: string[]; selected?: { id: number; title: string }[] };

function normalizeMovie(value: unknown): Movie | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Partial<Movie>;
  if (typeof x.id !== 'number' || typeof x.title !== 'string') return null;
  return { id: x.id, mediaType: 'movie', title: x.title, overview: x.overview ?? '', poster: x.poster ?? null, backdrop: x.backdrop ?? null, releaseDate: x.releaseDate ?? '', year: x.year ?? '', rating: typeof x.rating === 'number' ? x.rating : null, language: x.language ?? '', genres: Array.isArray(x.genres) ? x.genres : [], trailerKey: x.trailerKey ?? null, trailerThumb: x.trailerThumb ?? null, providers: Array.isArray(x.providers) ? x.providers : [], watchLink: x.watchLink ?? null };
}

export default function MovieCollidePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [movieError, setMovieError] = useState('');
  const [selected, setSelected] = useState<Movie[]>([]);
  const [collisionLoading, setCollisionLoading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [collisionError, setCollisionError] = useState('');
  const [result, setResult] = useState<CollisionResult | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMovies = useCallback(async (term: string) => {
    setLoadingMovies(true); setMovieError('');
    try {
      const params = new URLSearchParams({ type: 'movie', language: '', region: 'IN', query: term, filter: 'Trending Now', page: '1', availability: 'all', genre: '', provider: '' });
      const response = await fetch(`/api/discover?${params}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load movies.');
      setMovies(Array.isArray(data.results) ? data.results.map(normalizeMovie).filter((x: Movie | null): x is Movie => x !== null) : []);
    } catch (error) { setMovieError(error instanceof Error ? error.message : 'Could not load movies.'); setMovies([]); }
    finally { setLoadingMovies(false); }
  }, []);

  useEffect(() => { void loadMovies(''); }, [loadMovies]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const toggleMovie = (movie: Movie) => {
    setResult(null); setCollisionError(''); setShareMessage('');
    setSelected(current => current.some(x => x.id === movie.id) ? current.filter(x => x.id !== movie.id) : current.length < 2 ? [...current, movie] : [current[1], movie]);
  };

  const runCollision = async () => {
    if (selected.length !== 2 || collisionLoading) return;
    setCollisionLoading(true); setCollisionError(''); setResult(null); setAnimating(true);
    const animation = new Promise<void>(resolve => { timerRef.current = setTimeout(() => { setAnimating(false); resolve(); }, 3500); });
    try {
      const request = fetch('/api/collide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstId: selected[0].id, secondId: selected[1].id }) })
        .then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not find a collision match.'); return data as CollisionResult; });
      const [data] = await Promise.all([request, animation]);
      setResult(data); if (!data.match) setCollisionError('No strong match was found. Try two different movies.');
    } catch (error) { setCollisionError(error instanceof Error ? error.message : 'Movie Collide failed. Please try again.'); }
    finally { if (timerRef.current) clearTimeout(timerRef.current); setAnimating(false); setCollisionLoading(false); }
  };

  const share = async () => {
    if (!result?.match) return;
    const url = `https://www.themoviedb.org/movie/${result.match.id}`;
    const message = `REELRADAR Movie Collide: ${selected.map(x => x.title).join(' + ')} → ${result.match.title}`;
    try { if (navigator.share) await navigator.share({ title: 'Movie Collide', text: message, url }); else { await navigator.clipboard.writeText(`${message} ${url}`); setShareMessage('Match link copied.'); } }
    catch { setShareMessage('Sharing was cancelled or unavailable.'); }
  };

  return <main className="collide-page">
    <header className="collide-header"><Link href="/" className="back-link"><ArrowLeft size={16} /></Link><Link href="/" className="wordmark">REEL<span>RADAR</span></Link></header>
    <section className="collide-hero"><div className="hero-glow"/><span className="eyebrow"></span><h1><span>MOVIE</span> COLLIDE</h1><p>Two movies. One unexpected connection. Discover the film that sits between your favourites.</p><div className="hero-mark"><GitMerge size={25}/><span>SELECT TWO MOVIES TO BEGIN</span></div></section>
    <section className="collide-content">
      <div className="section-top"><div><span className="eyebrow">THE COLLISION LAB</span><h2>Choose your two movies</h2><p>Select any two films. We’ll find a movie that connects their cinematic DNA.</p></div><div className="selection-count">{selected.length}<span>/2 SELECTED</span></div></div>
      <form className="movie-search" onSubmit={e => { e.preventDefault(); setSearch(query.trim()); void loadMovies(query.trim()); }}><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a movie…"/><button type="submit">Search <ArrowUpRight size={14}/></button></form>
      <div className="selected-strip">{[0,1].map(index => <div className={`selected-slot ${selected[index] ? 'filled' : ''}`} key={index}>{selected[index] ? <><img src={selected[index].poster ?? ''} alt=""/><span><small>MOVIE {index+1}</small><strong>{selected[index].title}</strong></span><button type="button" aria-label={`Remove ${selected[index].title}`} onClick={() => toggleMovie(selected[index])}><X size={15}/></button></> : <span className="empty-slot">{index+1} <small>Choose a movie</small></span>}</div>)}</div>
      <div className="selection-actions"><span>{selected.length === 2 ? 'Ready for the collision.' : `Select ${2-selected.length} more movie${2-selected.length === 1 ? '' : 's'}.`}</span><div><button className="clear-button" type="button" disabled={!selected.length || collisionLoading} onClick={() => { setSelected([]); setResult(null); setCollisionError(''); }}>Clear</button><button className="collide-button" type="button" disabled={selected.length !== 2 || collisionLoading} onClick={() => void runCollision()}><GitMerge size={16}/> COLLIDE</button></div></div>
      {collisionError && !collisionLoading && <p className="error-message" role="alert">{collisionError}</p>}
      {collisionLoading && !animating && <p className="waiting"><LoaderCircle className="spin" size={17}/> Finding the strongest connection…</p>}
      {animating && <div className="collision-stage" role="status"><div className="flying-poster left">{selected[0]?.poster && <img src={selected[0].poster} alt=""/>}</div><div className="impact"><i/><i/><i/></div><div className="flying-poster right">{selected[1]?.poster && <img src={selected[1].poster} alt=""/>}</div><strong>FINDING YOUR PERFECT MATCH</strong></div>}
      {result?.match && !collisionLoading && <section className="result-panel"><div className="result-main"><div className="result-poster">{result.match.poster && <img src={result.match.poster} alt={`${result.match.title} poster`}/>}</div><div><span className="eyebrow">YOUR COLLISION MATCH</span><h3>{result.match.title}</h3><p className="result-meta">{result.match.year || 'Year unavailable'} · {result.match.rating !== null ? `★ ${result.match.rating.toFixed(1)}` : 'Not rated'} · {result.match.genreNames?.join(' · ') || 'Movie'}</p><p>{result.match.overview || 'Overview unavailable.'}</p><a className="tmdb-link" href={`https://www.themoviedb.org/movie/${result.match.id}`} target="_blank" rel="noreferrer">View on TMDB <ArrowUpRight size={14}/></a></div></div>
        <div className="why-match"><h4>Why this match</h4><div><strong>{selected[0]?.title}</strong><p>{result.reasonA?.join(' · ') || 'Shared cinematic themes and discovery signals'}</p></div><div><strong>{selected[1]?.title}</strong><p>{result.reasonB?.join(' · ') || 'Shared cinematic themes and discovery signals'}</p></div></div>
        {!!result.runnersUp?.length && <div className="runner-ups"><h4>More possible matches</h4><div>{result.runnersUp.map(movie => <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noreferrer" key={movie.id}><span>{movie.poster && <img src={movie.poster} alt=""/>}</span><strong>{movie.title}</strong><small>{movie.year} {movie.rating !== null ? `· ★ ${movie.rating.toFixed(1)}` : ''}</small></a>)}</div></div>}
        <div className="result-actions"><button type="button" onClick={() => void runCollision()}>Collide again</button><button type="button" onClick={() => void share()}><Share2 size={15}/> Share match</button></div>{shareMessage && <p className="share-message" role="status">{shareMessage}</p>}</section>}
      <div className="movie-list-heading"><h3>{search ? `Search results for “${search}”` : 'Trending movies'}</h3><span>TMDB MOVIE DATABASE</span></div>
      {loadingMovies ? <div className="movie-grid">{Array.from({length:10},(_,i)=><div className="skeleton" key={i}/>)}</div> : movieError ? <p className="error-message">{movieError} <button type="button" onClick={() => void loadMovies(search)}>Retry</button></p> : <div className="movie-grid">{movies.map(movie => { const index = selected.findIndex(x => x.id === movie.id); return <button type="button" className={`movie-card ${index >= 0 ? 'chosen' : ''}`} key={movie.id} onClick={() => toggleMovie(movie)}><span className="poster">{movie.poster ? <img src={movie.poster} alt={`${movie.title} poster`} loading="lazy"/> : <Film size={26}/>}<i>{index >= 0 ? `SELECTED ${index+1}` : <GitMerge size={16}/>}</i></span><strong>{movie.title}</strong><small>{movie.year || 'Release date TBA'} {movie.rating !== null && <><span> · </span><Star size={11} fill="currentColor"/> {movie.rating.toFixed(1)}</>}</small></button>; })}</div>}
    </section>
    <footer className="footer">
  <a className="brand" href="/">
    <span className="brand-mark">
      <Clapperboard size={17} strokeWidth={1.7} />
    </span>
    <span>REEL<span>RADAR</span></span>
  </a>

  <p>One place for everything worth watching.</p>

  <span className="footer-credit">
    MOVIE DATA &amp; IMAGES BY TMDB · NOT AN OFFICIAL TMDB PRODUCT
  </span>
</footer>
    <style jsx>{`
      .collide-page{min-height:100vh;background:#08090d;color:#f5f6f7;font-family:inherit}.collide-header{height:72px;padding:0 max(5vw,22px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff12;background:#0b0d12}.back-link{display:flex;align-items:center;gap:8px;color:#b9bec8;text-decoration:none;font-size:13px}.wordmark,.collide-footer>span{font-weight:900;letter-spacing:.08em;color:#fff;text-decoration:none}.wordmark span,.collide-footer>span span{color:#DFFF00}.collide-hero{position:relative;overflow:hidden;text-align:center;padding:76px 20px 62px;background:radial-gradient(ellipse at 50% 0%,#252d0c 0%,#10120c 35%,#08090d 75%)}.hero-glow{position:absolute;width:360px;height:200px;left:calc(50% - 180px);top:-130px;background:#dfff00;filter:blur(100px);opacity:.18}.eyebrow{color:#DFFF00;font-size:10px;font-weight:850;letter-spacing:.2em}.collide-hero h1{position:relative;margin:15px 0;font-size:clamp(42px,8vw,82px);line-height:.95;letter-spacing:-.06em;font-weight:950}.collide-hero h1 span{color:#DFFF00}.collide-hero>p{max-width:570px;margin:18px auto;color:#aeb4bf;font-size:15px;line-height:1.7}.hero-mark{display:inline-flex;align-items:center;gap:10px;margin-top:20px;padding:11px 15px;border:1px solid #dfff0038;border-radius:999px;color:#e5f99b;font-size:10px;font-weight:800;letter-spacing:.14em}.collide-content{width:min(1180px,90vw);margin:0 auto;padding:48px 0 75px}.section-top{display:flex;justify-content:space-between;align-items:center;gap:20px}.section-top h2{margin:8px 0;font-size:clamp(23px,3vw,32px)}.section-top p{margin:0;color:#9ca3af;font-size:13px}.selection-count{display:flex;align-items:center;gap:9px;color:#DFFF00;font-size:27px;font-weight:900}.selection-count span{max-width:62px;color:#8e96a3;font-size:9px;letter-spacing:.12em}.movie-search{display:flex;align-items:center;gap:12px;margin:28px 0 16px;padding:8px 10px 8px 15px;border:1px solid #ffffff20;border-radius:12px;background:#11141a;color:#9ca3af}.movie-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#fff;font:inherit}.movie-search button,.collide-button{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 15px;border:0;border-radius:9px;background:#DFFF00;color:#08090d;font-size:11px;font-weight:900;cursor:pointer}.selected-strip{display:grid;grid-template-columns:1fr 1fr;gap:12px}.selected-slot{min-height:78px;display:flex;align-items:center;gap:12px;padding:10px;border:1px dashed #ffffff30;border-radius:12px;background:#ffffff06}.selected-slot.filled{border-style:solid;border-color:#dfff0055}.selected-slot>img{width:40px;height:58px;object-fit:cover;border-radius:6px}.selected-slot>span:not(.empty-slot){display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.selected-slot small{color:#9ca3af;font-size:9px;letter-spacing:.12em}.selected-slot strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.selected-slot button{border:0;background:transparent;color:#aeb4bf;cursor:pointer}.empty-slot{display:flex;align-items:center;gap:12px;color:#DFFF00;font-size:22px;font-weight:800}.empty-slot small{color:#828995;font-size:12px;font-weight:500;letter-spacing:0}.selection-actions{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:15px 0 28px;color:#9ca3af;font-size:12px}.selection-actions>div,.result-actions{display:flex;gap:9px}.clear-button,.result-actions button{padding:10px 13px;border:1px solid #ffffff25;border-radius:9px;background:transparent;color:#e5e7eb;font-size:11px;font-weight:800;cursor:pointer}.clear-button:disabled{opacity:.35;cursor:not-allowed}.collide-button:disabled{opacity:.35;cursor:not-allowed}.movie-list-heading{display:flex;align-items:center;justify-content:space-between;margin:34px 0 16px}.movie-list-heading h3{margin:0;font-size:18px}.movie-list-heading>span{color:#777f8b;font-size:9px;letter-spacing:.13em}.movie-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:17px}.movie-card{min-width:0;padding:0;border:1px solid #ffffff12;border-radius:12px;overflow:hidden;background:#11141a;color:#fff;text-align:left;cursor:pointer;transition:border-color .2s,transform .2s}.movie-card:hover{transform:translateY(-3px);border-color:#dfff0080}.movie-card.chosen{border:2px solid #DFFF00;box-shadow:0 0 22px #dfff0020}.poster{position:relative;display:grid;place-items:center;aspect-ratio:2/3;background:#1b1e25;color:#DFFF00}.poster img{width:100%;height:100%;object-fit:cover}.poster i{position:absolute;top:9px;left:9px;padding:7px;border-radius:7px;background:#08090ddd;color:#DFFF00;font-size:9px;font-style:normal;font-weight:900}.movie-card>strong,.movie-card>small{display:flex;align-items:center;gap:4px;margin:10px 10px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.movie-card>strong{font-size:12px}.movie-card>small{margin:5px 10px 12px;color:#9ca3af;font-size:10px}.movie-card>small svg{color:#DFFF00}.skeleton{aspect-ratio:2/3;border-radius:12px;background:linear-gradient(110deg,#171a20 8%,#252a32 18%,#171a20 33%);background-size:200% 100%;animation:shimmer 1.4s linear infinite}@keyframes shimmer{to{background-position-x:-200%}}.error-message{padding:15px;color:#ff9b9b}.error-message button{margin-left:10px;color:#DFFF00;background:transparent;border:0;cursor:pointer}.waiting{display:flex;justify-content:center;align-items:center;gap:10px;padding:24px;color:#DFFF00}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.collision-stage{height:205px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:14px;background:radial-gradient(ellipse,#dfff0020,#0002 65%)}.flying-poster{position:absolute;width:85px;height:128px;overflow:hidden;border:1px solid #ffffff66;border-radius:9px;box-shadow:0 12px 35px #0009}.flying-poster img{width:100%;height:100%;object-fit:cover}.flying-poster.left{left:calc(50% - 155px);animation:flyleft 1.2s ease both}.flying-poster.right{right:calc(50% - 155px);animation:flyright 1.2s ease both}@keyframes flyleft{to{transform:translateX(70px)}}@keyframes flyright{to{transform:translateX(-70px)}}.impact{width:12px;height:12px;border-radius:50%;background:#DFFF00;box-shadow:0 0 25px 15px #dfff0080}.impact i{position:absolute;inset:calc(50% - 22px);border:2px solid #dfff00aa;border-radius:50%;animation:wave 1s ease-out infinite}@keyframes wave{to{transform:scale(5);opacity:0}}.collision-stage>strong{position:absolute;bottom:18px;color:#DFFF00;font-size:10px;letter-spacing:.18em}.result-panel{margin-top:28px;padding:22px;border:1px solid #dfff0040;border-radius:16px;background:linear-gradient(135deg,#dfff000d,#ffffff05);animation:reveal .5s ease both}@keyframes reveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.result-main{display:grid;grid-template-columns:155px 1fr;gap:22px;align-items:center}.result-poster{aspect-ratio:2/3;overflow:hidden;border-radius:10px;background:#171a20}.result-poster img{width:100%;height:100%;object-fit:cover}.result-main h3{margin:8px 0;font-size:27px}.result-main p{color:#b5bbc5;font-size:13px;line-height:1.6}.result-main .result-meta{color:#DFFF00}.tmdb-link{display:inline-flex;align-items:center;gap:6px;color:#DFFF00;font-size:12px;text-decoration:none}.why-match{margin-top:22px}.why-match h4,.runner-ups h4{margin:0 0 10px}.why-match>div{margin-top:8px;padding:11px 13px;border-left:2px solid #DFFF00;background:#ffffff08}.why-match strong{color:#DFFF00;font-size:12px}.why-match p{margin:5px 0 0;color:#aeb4bf;font-size:12px}.runner-ups{margin-top:22px}.runner-ups>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px}.runner-ups a{min-width:0;color:#fff;text-decoration:none}.runner-ups a>span{display:block;aspect-ratio:2/3;overflow:hidden;border-radius:8px;background:#171a20}.runner-ups img{width:100%;height:100%;object-fit:cover}.runner-ups strong,.runner-ups small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:7px;font-size:11px}.runner-ups small{color:#9ca3af}.result-actions{margin-top:20px}.share-message{color:#DFFF00;font-size:12px}.collide-footer{padding:25px;text-align:center;border-top:1px solid #ffffff12;color:#8f96a2}.collide-footer p{font-size:12px}.collide-footer small{font-size:9px;letter-spacing:.1em}.collide-footer>span{font-size:14px}@media(max-width:850px){.movie-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:600px){.collide-header{height:62px}.collide-hero{padding:58px 18px 45px}.collide-content{width:92vw;padding-top:32px}.section-top{align-items:flex-start}.section-top p{max-width:280px;line-height:1.5}.movie-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.selected-strip{gap:8px}.selected-slot{min-height:70px;padding:7px;gap:7px}.selected-slot>img{width:32px;height:48px}.selected-slot strong{font-size:10px}.empty-slot{gap:6px;font-size:17px}.empty-slot small{font-size:10px}.selection-actions{align-items:flex-start;flex-direction:column}.result-panel{padding:13px}.result-main{grid-template-columns:105px 1fr;gap:13px}.result-main h3{font-size:19px}.result-main p{font-size:11px}.runner-ups>div{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.runner-ups a:nth-child(n+4){display:none}.movie-list-heading>span{font-size:8px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}}
    `}</style>
  </main>;
}
