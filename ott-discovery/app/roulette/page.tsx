'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Dices, ExternalLink, Film, LoaderCircle, RotateCcw, Star, Volume2, VolumeX, X } from 'lucide-react';

type MediaType = 'movie' | 'tv';
type Title = {
  id: number; mediaType: MediaType; title: string; overview: string; poster: string | null; backdrop: string | null;
  releaseDate: string; year: string; rating: number | null; language: string; genres: number[]; genreNames?: string[];
  trailerKey?: string | null; runtime?: number | null; seasons?: number | null;
  providers?: { id: number; name: string; logo: string | null }[]; watchLink?: string | null;
};
type Genre = { id: number; name: string };
const LANGUAGES = [
  ['en','English'],['hi','Hindi'],['ko','Korean'],['ja','Japanese'],['ta','Tamil'],['te','Telugu'],['ml','Malayalam'],['es','Spanish'],['fr','French'],['de','German'],['it','Italian'],['zh','Chinese'],['cn','Cantonese'],['th','Thai'],['id','Indonesian'],['pt','Portuguese'],['ru','Russian'],['ar','Arabic'],['tr','Turkish'],['sv','Swedish'],['fa','Persian'],['bn','Bengali'],['kn','Kannada'],['pa','Punjabi'],
];
const WISHLIST_KEY = 'reelradar-wishlist-v1';
const currentYear = new Date().getFullYear();

export default function MovieRoulettePage() {
  const [type, setType] = useState<'any' | 'movie' | 'tv' | 'documentary'>('any');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [language, setLanguage] = useState('');
  const [rating, setRating] = useState(0);
  const [fromYear, setFromYear] = useState(0);
  const [toYear, setToYear] = useState(0);
  const [pool, setPool] = useState<Title[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Title | null>(null);
  const [zoomingWinnerKey, setZoomingWinnerKey] = useState<string | null>(null);
  const [history, setHistory] = useState<Title[]>([]);
  const [mute, setMute] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef<{ x: number; rotation: number; lastX: number; lastTime: number; velocity: number } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const lastTickRef = useRef(-1);
  const spinTimerRef = useRef<number | null>(null);
  const detailCache = useRef<Map<string, Title>>(new Map());

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    let alive = true;
    const genreType = type === 'tv' ? 'tv' : type === 'any' ? 'any' : 'movie';
    fetch(`/api/roulette?action=genres&type=${genreType}`)
      .then(r => r.json()).then(d => { if (alive) setGenres(Array.isArray(d.genres) ? d.genres : []); })
      .catch(() => { if (alive) setGenres([]); });
    return () => { alive = false; };
  }, [type]);

  const filterKey = useMemo(() => JSON.stringify([type, selectedGenres, language, rating, fromYear, toYear]), [type, selectedGenres, language, rating, fromYear, toYear]);
  const loadPool = useCallback(async () => {
    setLoading(true); setError(''); setWinner(null);
    try {
      const params = new URLSearchParams({ action: 'pool', type, genres: selectedGenres.join(','), language, rating: String(rating), fromYear: String(fromYear), toYear: String(toYear) });
      const response = await fetch(`/api/roulette?${params}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not find titles for these filters.');
      setPool(Array.isArray(data.titles) ? data.titles : []);
      setTotalResults(Number(data.totalResults) || 0);
      setRotation(value => value + 26);
    } catch (e) { setPool([]); setTotalResults(0); setError(e instanceof Error ? e.message : 'Something went wrong while loading titles.'); }
    finally { setLoading(false); }
  }, [filterKey]);

  useEffect(() => { const id = window.setTimeout(() => void loadPool(), 250); return () => window.clearTimeout(id); }, [loadPool]);

  useEffect(() => () => { if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current); audioRef.current?.close().catch(() => undefined); }, []);

  const toggleGenre = (id: number) => setSelectedGenres(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const resetFilters = () => { setType('any'); setSelectedGenres([]); setLanguage(''); setRating(0); setFromYear(0); setToYear(0); };

  const playTick = useCallback(() => {
    if (mute) return;
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = audioRef.current ?? new AudioCtor(); audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(1050, ctx.currentTime);
      gain.gain.setValueAtTime(0.035, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.04);
    } catch { /* Audio is optional; wheel remains usable without it. */ }
  }, [mute]);

  const reveal = useCallback(async (item: Title) => {
    const key = `${item.mediaType}-${item.id}`;
    let full = detailCache.current.get(key);
    if (!full) {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/roulette?action=detail&type=${item.mediaType}&id=${item.id}`);
        const data = await response.json();
        if (response.ok) { full = data as Title; detailCache.current.set(key, full); }
      } catch { /* Keep the discover result as a usable fallback. */ }
      finally { setDetailLoading(false); }
    }
    const result = full ?? item;
    setWinner(result);
    setZoomingWinnerKey(null);
    setSpinning(false);
    setHistory(current => [result, ...current.filter(x => !(x.id === result.id && x.mediaType === result.mediaType))].slice(0, 6));
  }, []);

  const spin = useCallback((initialVelocity = 0) => {
    if (spinning || pool.length < 2) return;
    setWinner(null); setZoomingWinnerKey(null); setSpinning(true);
    const previous = history[0];
    const candidates = pool.filter(x => !(previous && x.id === previous.id && x.mediaType === previous.mediaType));
    const choice = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    const index = pool.findIndex(x => x.id === choice.id && x.mediaType === choice.mediaType);
    const slice = 360 / pool.length;
    const target = 360 * (5 + Math.floor(Math.random() * 3)) + (360 - index * slice - slice / 2);
    const start = rotation;
    const duration = reducedMotion ? 420 : 5600 + Math.min(900, Math.abs(initialVelocity) * 2);
    const end = start + target;
    const started = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    let previousSlice = -1;
    const frame = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const angle = start + (end - start) * ease(t);
      setRotation(angle);
      const currentSlice = Math.floor((((angle % 360) + 360) % 360) / slice);
      if (currentSlice !== previousSlice) { previousSlice = currentSlice; playTick(); }
      if (t < 1) requestAnimationFrame(frame);
      else {
        // Land exactly on the chosen title, hold it in the center, then zoom it forward
        // before opening the existing full result card.
        setRotation(end);
        setZoomingWinnerKey(`${choice.mediaType}-${choice.id}`);
        spinTimerRef.current = window.setTimeout(() => {
          void reveal(choice);
        }, reducedMotion ? 100 : 720);
      }
    };
    requestAnimationFrame(frame);
  }, [spinning, pool, history, rotation, reducedMotion, playTick, reveal]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (spinning || pool.length < 2) return;
    dragRef.current = { x: event.clientX, rotation, lastX: event.clientX, lastTime: performance.now(), velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current; if (!drag) return;
    const now = performance.now(); const dx = event.clientX - drag.lastX;
    drag.velocity = dx / Math.max(1, now - drag.lastTime); drag.lastX = event.clientX; drag.lastTime = now;
    setRotation(drag.rotation + (event.clientX - drag.x) * 0.9);
  };
  const onPointerUp = () => {
    const drag = dragRef.current; if (!drag) return;
    dragRef.current = null;
    const distance = Math.abs(rotation - drag.rotation);
    if (distance > 12 || Math.abs(drag.velocity) > 0.15) spin(Math.max(0, Math.abs(drag.velocity) * 1000));
  };

  const addToWatchlist = () => {
    if (!winner) return;
    try {
      const saved = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
      const entry = { ...winner, trailerThumb: winner.trailerKey ? `https://img.youtube.com/vi/${winner.trailerKey}/hqdefault.jpg` : null };
      if (!saved.some((x: any) => x.id === winner!.id && x.mediaType === winner!.mediaType)) localStorage.setItem(WISHLIST_KEY, JSON.stringify([...saved, entry]));
    } catch { /* Wishlist storage may be unavailable in private browsing. */ }
  };

  const sliceAngle = pool.length ? 360 / pool.length : 360;

  return <main className="roulette-page">
    <style jsx global>{`
      .roulette-page{min-height:100vh;background:radial-gradient(ellipse at 50% 22%,rgba(91,83,32,.16),transparent 42%),#08090d;color:#f5f6f8;padding:26px clamp(16px,4vw,56px) 64px;font-family:inherit;overflow:hidden}
      .roulette-top{max-width:1180px;margin:0 auto 30px;display:flex;align-items:center;justify-content:space-between;gap:16px}.roulette-route-nav{display:flex;align-items:center;gap:18px}.roulette-route-nav a{display:flex;align-items:center;gap:6px;color:#9ba1ad;text-decoration:none;font-size:12px;font-weight:700}.roulette-route-nav a.active{color:#eaff72}.roulette-back{display:inline-flex;align-items:center;gap:8px;color:#aeb3bf;text-decoration:none;font-size:13px;font-weight:700}.roulette-brand{font-size:13px;letter-spacing:.2em;color:#aeb3bf}.roulette-brand b{color:#dfff00}.roulette-heading{text-align:center;margin:18px auto 24px}.roulette-kicker{font-size:10px;letter-spacing:.28em;color:#dfff00;font-weight:800}.roulette-heading h1{font-size:clamp(32px,5vw,56px);letter-spacing:-.055em;margin:9px 0 8px;font-weight:900}.roulette-heading p{color:#9ba1ad;margin:0;font-size:14px}
      .roulette-layout{max-width:1180px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:30px;align-items:start}.roulette-stage{min-width:0;display:flex;flex-direction:column;align-items:center}.roulette-card-stage{width:min(100%,760px);height:clamp(360px,43vw,510px);position:relative;perspective:1400px;overflow:visible;touch-action:pan-y;user-select:none;margin:5px auto 18px;isolation:isolate}
      .roulette-stage-glow{position:absolute;inset:12% 8%;background:radial-gradient(ellipse,rgba(202,226,54,.16),rgba(77,105,150,.09) 38%,transparent 72%);filter:blur(28px);pointer-events:none}
      .roulette-stage-scanline{position:absolute;inset:0;pointer-events:none;opacity:.22;background:linear-gradient(180deg,transparent 0%,rgba(218,240,110,.08) 49.8%,rgba(218,240,110,.22) 50%,transparent 50.4%);z-index:30}
      .roulette-card-track{position:absolute;inset:0;transform-style:preserve-3d}
      .roulette-movie-card{position:absolute;left:50%;top:47%;width:clamp(168px,21vw,238px);height:clamp(270px,34vw,350px);padding:0;border:1px solid rgba(255,255,255,.18);border-radius:18px;overflow:hidden;text-align:left;color:#f7f8fa;background:linear-gradient(160deg,#202633,#0b0e14);box-shadow:0 22px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.16);transform-style:preserve-3d;transform-origin:center center;transition:transform .12s linear,opacity .12s linear,filter .12s linear,border-color .25s ease,box-shadow .25s ease;cursor:pointer;will-change:transform,opacity,filter}
      .roulette-movie-card.is-centered{border-color:rgba(223,255,0,.65);box-shadow:0 30px 85px rgba(0,0,0,.72),0 0 35px rgba(223,255,0,.14),inset 0 1px 0 rgba(255,255,255,.2)}
.roulette-movie-card.is-zooming-winner{border-color:rgba(234,255,114,.95);box-shadow:0 38px 110px rgba(0,0,0,.82),0 0 55px rgba(223,255,0,.28),inset 0 1px 0 rgba(255,255,255,.28);transition:transform .68s cubic-bezier(.16,1,.3,1),opacity .45s ease,filter .45s ease,box-shadow .5s ease,border-color .5s ease;pointer-events:none}
      .roulette-movie-poster{position:absolute;inset:0;display:block;background:linear-gradient(145deg,#252c39,#0b0e14)}
      .roulette-movie-poster img{width:100%;height:100%;display:block;object-fit:cover}
      .roulette-poster-fallback{position:absolute;inset:0;display:grid;place-items:center;color:#dfff00}
      .roulette-poster-vignette{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,5,9,.05) 35%,rgba(3,5,9,.3) 56%,rgba(3,5,9,.97) 100%),linear-gradient(90deg,rgba(3,5,9,.18),transparent 28%,transparent 72%,rgba(3,5,9,.18))}
      .roulette-card-index{position:absolute;top:12px;left:13px;font-size:10px;letter-spacing:.18em;font-weight:900;color:#eaff72;text-shadow:0 2px 10px #000}
      .roulette-card-rating{position:absolute;right:11px;top:10px;display:flex;align-items:center;gap:4px;padding:6px 8px;border:1px solid rgba(255,255,255,.2);border-radius:99px;background:rgba(4,6,10,.62);backdrop-filter:blur(10px);font-size:10px;font-weight:800}
      .roulette-card-rating svg{color:#eaff72}
      .roulette-movie-info{position:absolute;left:15px;right:15px;bottom:16px;display:flex;flex-direction:column;gap:6px;text-shadow:0 2px 10px #000}
      .roulette-movie-info strong{font-size:clamp(15px,1.8vw,19px);font-weight:900;line-height:1.12;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .roulette-movie-info small{font-size:9px;letter-spacing:.14em;color:#c7cbd2;font-weight:800}
      .roulette-movie-info i{font-style:normal;color:#eaff72;padding:0 4px}
      .roulette-carousel-centerline{position:absolute;left:50%;top:7%;bottom:8%;width:1px;background:linear-gradient(transparent,rgba(223,255,0,.24),transparent);pointer-events:none;z-index:25}
      .roulette-carousel-caption{position:absolute;z-index:31;bottom:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;white-space:nowrap;color:#aeb6c5;font-size:9px;font-weight:900;letter-spacing:.2em;text-shadow:0 2px 8px #000}
      .roulette-live-dot{width:6px;height:6px;border-radius:50%;background:#dfff00;box-shadow:0 0 12px #dfff00;animation:roulettePulse 1s ease-in-out infinite}
      .roulette-card-stage.is-spinning .roulette-movie-card{transition:transform .045s linear,opacity .08s linear,filter .08s linear}
      .roulette-card-stage.is-spinning .roulette-stage-glow{animation:rouletteGlow .65s ease-in-out infinite alternate}
      @keyframes roulettePulse{50%{opacity:.35;box-shadow:0 0 3px #dfff00}}
      @keyframes rouletteGlow{to{opacity:.45;transform:scale(1.12)}}
      .roulette-spin{border:0;border-radius:999px;padding:15px 52px;background:linear-gradient(135deg,#edff5b,#b4d000);color:#11140a;font-size:15px;font-weight:950;letter-spacing:.2em;box-shadow:0 8px 30px rgba(223,255,0,.18);cursor:pointer;display:inline-flex;align-items:center;gap:10px}.roulette-spin:disabled{opacity:.45;cursor:not-allowed}.roulette-spin:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 12px 35px rgba(223,255,0,.28)}.roulette-controls{display:flex;align-items:center;justify-content:center;gap:15px;margin-top:12px}.roulette-mute{display:inline-flex;align-items:center;gap:7px;background:transparent;border:1px solid #343743;color:#b6bac4;border-radius:999px;padding:9px 13px;font-size:12px;cursor:pointer}.roulette-hint{font-size:11px;color:#737987;text-align:center;margin:14px 0 0}.roulette-filter-card{background:linear-gradient(160deg,#151821,#0d0f15);border:1px solid #292d38;border-radius:18px;padding:19px;box-shadow:0 15px 40px rgba(0,0,0,.22)}.roulette-filters-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.roulette-filters h2,.roulette-filter-card h2{font-size:13px;letter-spacing:.13em;margin:0}.roulette-reset{border:0;background:transparent;color:#dfff00;font-size:11px;cursor:pointer}.roulette-field{margin:0 0 17px}.roulette-field label{display:block;font-size:11px;color:#9ea4b0;font-weight:750;margin-bottom:8px}.roulette-field select,.roulette-field input[type=number]{width:100%;background:#090b10;border:1px solid #303542;color:#f2f3f5;border-radius:9px;padding:10px;font:inherit;font-size:12px}.roulette-type-row{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.roulette-type-row button,.roulette-chip{border:1px solid #303542;background:#0b0d12;color:#aeb4c0;border-radius:8px;padding:9px 8px;font-size:11px;cursor:pointer}.roulette-type-row button.active,.roulette-chip.active{border-color:rgba(223,255,0,.55);background:rgba(223,255,0,.1);color:#eaff72}.roulette-chips{display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow:auto}.roulette-chip{padding:7px 9px}.roulette-range{display:flex;gap:8px}.roulette-range input{min-width:0}.roulette-rating{display:flex;align-items:center;gap:12px}.roulette-rating input{flex:1;accent-color:#dfff00}.roulette-rating strong{font-size:12px;color:#eaff72;min-width:28px}.roulette-count{border-top:1px solid #2b2f3a;padding-top:13px;color:#969daa;font-size:11px}.roulette-count strong{color:#eaff72;font-size:14px}.roulette-mobile-filter-panel{display:none}.roulette-status{color:#aab0bc;font-size:13px;text-align:center;margin:18px 0}.roulette-history{max-width:1180px;margin:34px auto 0;border-top:1px solid #252934;padding-top:20px}.roulette-history h3{font-size:11px;letter-spacing:.18em;color:#aeb4c0;margin:0 0 12px}.roulette-history-list{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}.roulette-history-item{flex:0 0 74px;color:#cbd0d9;font-size:10px;text-align:center}.roulette-history-item img{width:74px;height:100px;object-fit:cover;border-radius:7px;display:block;margin-bottom:6px}.roulette-result-backdrop{position:fixed;z-index:40;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(12px);display:grid;place-items:center;padding:18px;animation:rouletteFade .25s ease}.roulette-result{width:min(760px,100%);max-height:90vh;overflow:auto;position:relative;background:linear-gradient(145deg,#1b1f29,#0b0d12);border:1px solid rgba(223,255,0,.3);border-radius:20px;box-shadow:0 25px 90px #000;display:grid;grid-template-columns:220px 1fr;gap:22px;padding:22px;animation:roulettePop .45s cubic-bezier(.2,1.4,.4,1)}.roulette-result>img{width:100%;border-radius:12px;max-height:330px;object-fit:cover;box-shadow:0 10px 28px #000}.roulette-result h2{font-size:clamp(22px,4vw,34px);line-height:1.05;margin:8px 0}.roulette-result p{font-size:12px;color:#b5bbc6;line-height:1.65}.roulette-result-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:#dfe2e8;font-size:11px;margin:10px 0}.roulette-result-meta span{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;box-sizing:border-box;border:1px solid #343a46;border-radius:99px;padding:7px 11px;line-height:1.2;white-space:nowrap}.roulette-result-meta span svg{display:block;flex:0 0 auto;width:13px;height:13px}.roulette-result-actions{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:16px}.roulette-result-actions a,.roulette-result-actions button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;box-sizing:border-box;border:1px solid #454b58;background:#10131a;color:#f5f6f8;text-decoration:none;border-radius:9px;padding:10px 13px;font-size:11px;font-weight:800;line-height:1.2;white-space:nowrap;cursor:pointer}.roulette-result-actions svg{display:block;flex:0 0 auto;width:14px;height:14px}.roulette-provider-row{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin-top:12px}.roulette-provider-row img{width:27px;height:27px;flex:0 0 27px;object-fit:cover;border-radius:7px}.roulette-provider-row a{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:5px 10px;border:1px solid #343a46;border-radius:9px;color:#cbd0d9;font-size:11px;line-height:1.2;text-decoration:none;white-space:nowrap}.roulette-result-actions .primary{background:#dfff00;color:#111;border-color:#dfff00}.roulette-close{position:absolute;right:12px;top:12px;border:0;background:#252a35;color:white;border-radius:50%;width:32px;height:32px;display:grid;place-items:center;cursor:pointer}.roulette-trailer{margin-top:16px;aspect-ratio:16/9;width:100%;border:0;border-radius:12px}.roulette-empty{border:1px dashed #383e4b;border-radius:18px;padding:28px;text-align:center;color:#aab0bc}.roulette-error{color:#ffaaa8}.roulette-loading{display:flex;align-items:center;gap:9px;color:#adb3bf;font-size:12px}.roulette-loading svg{animation:rouletteSpin 1s linear infinite}@keyframes rouletteSpin{to{transform:rotate(360deg)}}@keyframes rouletteFade{from{opacity:0}to{opacity:1}}@keyframes roulettePop{from{opacity:0;transform:scale(.86) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @media(max-width:850px){.roulette-route-nav{display:none}.roulette-layout{grid-template-columns:1fr}.roulette-layout>.roulette-filters{display:none}.roulette-mobile-filter-panel{display:block;width:100%;margin:0 auto 24px}.roulette-filter-card{width:100%;padding:22px;border-radius:18px}.roulette-filter-card .roulette-chips{max-height:190px}.roulette-filter-card .roulette-type-row button,.roulette-filter-card .roulette-chip{min-height:40px}.roulette-card-stage{height:430px}.roulette-heading{margin-top:8px}.roulette-result{grid-template-columns:130px 1fr;gap:15px;padding:16px}.roulette-result>img{max-height:240px}}
      @media(max-width:480px){.roulette-result-meta{gap:7px;margin:9px 0}.roulette-result-meta span{min-height:30px;padding:6px 9px;gap:6px;font-size:10px}.roulette-result-actions{gap:8px}.roulette-result-actions a,.roulette-result-actions button{min-height:40px;padding:10px 11px;font-size:10px}.roulette-provider-row{gap:7px}.roulette-provider-row a{min-height:36px;padding:5px 8px;font-size:10px}.roulette-page{padding:18px 14px 48px}.roulette-filter-card{padding:18px 15px}.roulette-filter-card .roulette-field{margin-bottom:19px}.roulette-filter-card .roulette-type-row button{padding:11px 8px}.roulette-filter-card .roulette-chip{padding:9px 10px}.roulette-top{margin-bottom:18px}.roulette-brand{font-size:10px}.roulette-heading h1{font-size:34px}.roulette-heading p{font-size:12px}.roulette-card-stage{height:390px}.roulette-movie-card{width:174px;height:278px}.roulette-spin{padding:14px 42px}.roulette-result{display:block}.roulette-result>img{width:104px;height:150px;float:left;margin:0 14px 8px 0}.roulette-result h2{padding-right:24px}.roulette-result p{clear:both;padding-top:8px}.roulette-result-actions a,.roulette-result-actions button{padding:9px 10px}.roulette-result-backdrop{padding:10px}}
      @media(prefers-reduced-motion:reduce){.roulette-result-backdrop,.roulette-result{animation:none!important}.roulette-spin:not(:disabled):hover{transform:none}}
    `}</style>

    <header className="roulette-top"><Link href="/" className="roulette-back"><ArrowLeft size={16}/></Link><nav className="roulette-route-nav"><Link href="/">Discover</Link><Link href="/collide">Movie Collide</Link><Link href="/roulette" className="active"><Dices size={14}/> Movie Roulette</Link></nav><span className="roulette-brand">REELRADAR</span></header>
    <div className="roulette-heading"><span className="roulette-kicker">LET FATE PICK YOUR NEXT WATCH</span><h1>MOVIE ROULETTE</h1><p>Set your mood. Spin the wheel. Find your next obsession.</p></div>

    <div className="roulette-layout">
      <section className="roulette-stage">
        <div className="roulette-mobile-filter-panel">
          <FilterPanel {...{type,setType,genres,selectedGenres,toggleGenre,language,setLanguage,rating,setRating,fromYear,setFromYear,toYear,setToYear,resetFilters,totalResults,loading}} />
        </div>
        <div className={`roulette-card-stage ${spinning ? 'is-spinning' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Movie roulette card carousel">
          <div className="roulette-stage-glow" />
          <div className="roulette-stage-scanline" />
          <div className="roulette-card-track">
            {pool.map((item, index) => {
              const targetAngle = ((360 - index * sliceAngle - sliceAngle / 2) % 360 + 360) % 360;
              const currentAngle = ((rotation % 360) + 360) % 360;
              const angleDiff = ((targetAngle - currentAngle + 540) % 360) - 180;
              const offset = angleDiff / sliceAngle;
              if (Math.abs(offset) > 3.15) return null;
              const distance = Math.abs(offset);
              const scale = Math.max(0.58, 1 - distance * 0.13);
              const opacity = Math.max(0.16, 1 - distance * 0.28);
              const isZoomingWinner = zoomingWinnerKey === `${item.mediaType}-${item.id}`;
              return <button key={`${item.mediaType}-${item.id}`} type="button" className={`roulette-movie-card ${distance < 0.18 ? 'is-centered' : ''} ${isZoomingWinner ? 'is-zooming-winner' : ''}`}
                style={{transform:isZoomingWinner ? 'translate(-50%,-50%) translateX(0) rotateY(0deg) scale(1.38)' : `translate(-50%,-50%) translateX(${offset * 174}px) rotateY(${-offset * 27}deg) scale(${scale})`,opacity:isZoomingWinner ? 1 : opacity,zIndex:isZoomingWinner ? 100 : Math.round(20-distance*4),filter:isZoomingWinner ? 'brightness(1.12)' : `brightness(${Math.max(0.38,1-distance*.2)})`}}
                onClick={() => { if (!spinning && distance < .55) void reveal(item); else if (!spinning) setRotation(rotation + angleDiff); }}
                tabIndex={distance < .55 ? 0 : -1} aria-label={item.title}>
                <span className="roulette-movie-poster">
                  {item.poster ? <img src={item.poster} alt="" draggable={false} loading="lazy"/> : <span className="roulette-poster-fallback"><Film size={34}/></span>}
                  <span className="roulette-poster-vignette"/><span className="roulette-card-index">{String(index+1).padStart(2,'0')}</span>
                  {item.rating !== null && <span className="roulette-card-rating"><Star size={11} fill="currentColor"/> {item.rating.toFixed(1)}</span>}
                </span>
                <span className="roulette-movie-info"><strong>{item.title}</strong><small>{item.year || 'YEAR TBA'} <i>·</i> {item.mediaType === 'tv' ? 'SERIES' : 'MOVIE'}</small></span>
              </button>;
            })}
          </div>
          <div className="roulette-carousel-centerline"/>
          <div className="roulette-carousel-caption"><span className="roulette-live-dot"/>{spinning ? 'SCANNING YOUR NEXT WATCH' : 'YOUR NEXT OBSESSION AWAITS'}</div>
        </div>
        {loading ? <p className="roulette-status"><span className="roulette-loading"><LoaderCircle size={16}/> Building your wheel…</span></p> : error ? <div className="roulette-empty roulette-error">{error}</div> : pool.length < 2 ? <div className="roulette-empty">No titles found for these filters. Try widening your year range or removing a genre.</div> : <>
          <button className="roulette-spin" type="button" disabled={spinning || loading} onClick={() => spin()}>{spinning ? 'SPINNING…' : <><Dices size={18}/> SPIN</>}</button>
          <div className="roulette-controls"><button className="roulette-mute" type="button" onClick={() => setMute(v => !v)}>{mute?<VolumeX size={15}/>:<Volume2 size={15}/>} {mute?'SOUND OFF':'SOUND ON'}</button></div>
          <p className="roulette-hint">Swipe or flick the cards to shuffle · {reducedMotion ? 'Reduced-motion mode enabled' : 'Let the carousel decide'}</p>
        </>}
      </section>

      <aside className="roulette-filters"><FilterPanel {...{type,setType,genres,selectedGenres,toggleGenre,language,setLanguage,rating,setRating,fromYear,setFromYear,toYear,setToYear,resetFilters,totalResults,loading}}/></aside>
    </div>

    <section className="roulette-history"><h3>RECENT SPINS</h3>{history.length ? <div className="roulette-history-list">{history.map(item=><div className="roulette-history-item" key={`${item.mediaType}-${item.id}`}><img src={item.poster ?? ''} alt=""/><span>{item.title}</span></div>)}</div> : <p className="roulette-hint" style={{textAlign:'left'}}>Your recent picks will appear here.</p>}</section>

    {winner && <div className="roulette-result-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setWinner(null)}}><section className="roulette-result" role="dialog" aria-modal="true" aria-label="Roulette winner">
      <button className="roulette-close" type="button" onClick={()=>setWinner(null)} aria-label="Close result"><X size={17}/></button>
      {winner.poster && <img src={winner.poster} alt={`${winner.title} poster`}/>}
      <div><span className="roulette-kicker">{detailLoading?'LOADING DETAILS':'THE WHEEL HAS SPOKEN'}</span><h2>{winner.title}</h2>
        <div className="roulette-result-meta"><span>{winner.year || 'Year TBA'}</span>{winner.rating!==null&&<span><Star size={11} fill="currentColor" style={{verticalAlign:'middle'}}/> {winner.rating.toFixed(1)}</span>}<span>{winner.mediaType==='tv'?'Series':'Movie'}</span><span>{winner.language?.toUpperCase() || '—'}</span></div>
        <div className="roulette-result-meta">{(winner.genreNames ?? []).map(g=><span key={g}>{g}</span>)}{winner.runtime ? <span>{winner.runtime} min</span> : winner.seasons ? <span>{winner.seasons} seasons</span> : null}</div>
        <p>{winner.overview || 'No overview is available for this title.'}</p>
        <div className="roulette-result-actions"><button className="primary" type="button" onClick={()=>spin()}> <RotateCcw size={13} style={{verticalAlign:'middle'}}/> Spin Again</button>
          {winner.trailerKey && <button type="button" onClick={()=>{const el=document.getElementById('roulette-trailer');el?.scrollIntoView({behavior:reducedMotion?'auto':'smooth'});}}>Watch Trailer</button>}
          <a href={winner.watchLink || `https://www.themoviedb.org/${winner.mediaType}/${winner.id}`} target="_blank" rel="noreferrer">View Details <ExternalLink size={12}/></a>
          <button type="button" onClick={addToWatchlist}><Check size={13} style={{verticalAlign:'middle'}}/> Add to Watchlist</button></div>
        {winner.providers?.length ? <><p style={{marginBottom:5,fontWeight:800}}>WHERE TO WATCH</p><div className="roulette-provider-row">{winner.providers.map(p=><a key={p.id} href={winner.watchLink || '#'} target="_blank" rel="noreferrer">{p.logo&&<img src={p.logo} alt=""/>}{p.name}</a>)}</div></>:<p style={{fontSize:10}}>Streaming provider availability was not returned for this title.</p>}
        {winner.trailerKey && <iframe id="roulette-trailer" className="roulette-trailer" src={`https://www.youtube-nocookie.com/embed/${winner.trailerKey}`} title={`${winner.title} trailer`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>}
      </div>
    </section></div>}
  </main>;
}

function FilterPanel(props: {
  type: 'any'|'movie'|'tv'|'documentary'; setType: (v:'any'|'movie'|'tv'|'documentary')=>void; genres: Genre[]; selectedGenres: number[]; toggleGenre:(id:number)=>void;
  language:string;setLanguage:(v:string)=>void;rating:number;setRating:(v:number)=>void;fromYear:number;setFromYear:(v:number)=>void;toYear:number;setToYear:(v:number)=>void;resetFilters:()=>void;totalResults:number;loading:boolean;
}) {
  const genreOptions = props.type === 'documentary' ? props.genres.filter(g=>g.id===99) : props.genres;
  return <div className="roulette-filter-card"><div className="roulette-filters-head"><h2>YOUR FILTERS</h2><button className="roulette-reset" type="button" onClick={props.resetFilters}>Reset filters</button></div>
    <div className="roulette-field"><label>TYPE</label><div className="roulette-type-row">{(['any','movie','tv','documentary'] as const).map(v=><button key={v} type="button" className={props.type===v?'active':''} onClick={()=>props.setType(v)}>{v==='any'?'Any':v==='tv'?'Series':v[0].toUpperCase()+v.slice(1)}</button>)}</div></div>
    <div className="roulette-field"><label>GENRES · MULTI-SELECT</label><div className="roulette-chips">{genreOptions.map(g=><button key={g.id} type="button" className={`roulette-chip ${props.selectedGenres.includes(g.id)?'active':''}`} onClick={()=>props.toggleGenre(g.id)}>{g.name}</button>)}{!genreOptions.length&&<span style={{fontSize:11,color:'#8f96a3'}}>Loading genres…</span>}</div></div>
    <div className="roulette-field"><label htmlFor="roulette-language">ORIGINAL LANGUAGE</label><select id="roulette-language" value={props.language} onChange={e=>props.setLanguage(e.target.value)}><option value="">Any language</option>{LANGUAGES.map(([code,name])=><option value={code} key={code}>{name}</option>)}</select></div>
    <div className="roulette-field"><label>MINIMUM RATING</label><div className="roulette-rating"><input type="range" min="0" max="9" step="0.5" value={props.rating} onChange={e=>props.setRating(Number(e.target.value))}/><strong>{props.rating ? `${props.rating.toFixed(1)}+` : 'Any'}</strong></div></div>
    <div className="roulette-field"><label>RELEASE YEAR RANGE</label><div className="roulette-range"><input aria-label="From year" type="number" min="1900" max={currentYear+2} placeholder="From" value={props.fromYear||''} onChange={e=>props.setFromYear(Math.max(0,Number(e.target.value)||0))}/><input aria-label="To year" type="number" min="1900" max={currentYear+2} placeholder="To" value={props.toYear||''} onChange={e=>props.setToYear(Math.max(0,Number(e.target.value)||0))}/></div></div>
    <div className="roulette-count">{props.loading?'Updating match count…':<><strong>{props.totalResults.toLocaleString()}</strong> titles match · wheel pool is sampled from up to 3 TMDB pages</>}</div>
  </div>;
}
