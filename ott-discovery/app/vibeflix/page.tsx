'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, Clapperboard, Clock3, ExternalLink, Heart, LoaderCircle, Play, RotateCcw, Share2, Shuffle, Sparkles, Star, Users, X } from 'lucide-react';
import './vibeflix.css';

type Provider = { id: number; name: string; logo: string | null };
type Title = {
  id: number; mediaType: 'movie' | 'tv'; title: string; overview: string; poster: string | null;
  backdrop: string | null; releaseDate: string; year: string; rating: number | null; voteCount: number;
  language: string; genres: number[]; runtime: number | null; providers: Provider[];
  watchLink: string | null; trailerKey: string | null; score: number; reasons: string[];
};
type Answers = { mood: string; outcome: string; format: string; company: string; vibe: string; language: string; region: string };
type Result = { match: Title; runnersUp: Title[]; matchPercent: number; totalCandidates: number; note: string };
type Choice = { value: string; emoji: string; title: string; sub?: string };
type Question = { key: keyof Pick<Answers, 'mood'|'outcome'|'format'|'company'|'vibe'>; eyebrow: string; title: string; subtitle: string; choices: Choice[] };

const QUESTIONS: Question[] = [
  { key: 'mood', eyebrow: '01 / YOUR HEADSPACE', title: 'How are you feeling tonight?', subtitle: 'Start with the mood you are bringing into the room.', choices: [
    { value: 'happy', emoji: '😄', title: 'Pretty good', sub: 'Keep the good energy going' }, { value: 'sad', emoji: '🥺', title: 'A little low', sub: 'I am okay with feeling things' },
    { value: 'stressed', emoji: '😮‍💨', title: 'Need to switch off', sub: 'Give my brain a break' }, { value: 'curious', emoji: '🧐', title: 'Curious', sub: 'Make me think' },
    { value: 'adventurous', emoji: '🤠', title: 'Restless', sub: 'Take me somewhere new' }, { value: 'scared', emoji: '😈', title: 'Ready for a scare', sub: 'I want the chills' },
    { value: 'romantic', emoji: '💗', title: 'In a romantic mood', sub: 'Give me butterflies' }, { value: 'bored', emoji: '🥱', title: 'Just bored', sub: 'Surprise me with something good' },
  ] },
  { key: 'outcome', eyebrow: '02 / THE FEELING', title: 'What do you want to feel?', subtitle: 'The aftertaste matters as much as the story.', choices: [
    { value: 'laugh', emoji: '😂', title: 'Laugh out loud', sub: 'A proper mood-lifter' }, { value: 'escape', emoji: '🚀', title: 'Escape reality', sub: 'Another world, another life' },
    { value: 'think', emoji: '🧩', title: 'Mind blown', sub: 'Twists that stay with me' }, { value: 'cry', emoji: '😭', title: 'Feel everything', sub: 'An emotional ride' },
    { value: 'adrenaline', emoji: '⚡', title: 'Heart racing', sub: 'No time to look away' }, { value: 'comfort', emoji: '🧸', title: 'Comforted', sub: 'Warm, familiar, feel-good' },
    { value: 'surprise', emoji: '🎭', title: 'Genuinely surprised', sub: 'Something I did not expect' },
  ] },
  { key: 'format', eyebrow: '03 / YOUR WATCH WINDOW', title: 'How much time have you got?', subtitle: 'We will keep the recommendation realistic.', choices: [
    { value: 'short', emoji: '⏱️', title: 'Under 90 minutes', sub: 'Short and satisfying' }, { value: 'feature', emoji: '🍿', title: 'A movie night', sub: 'Around 90–145 minutes' },
    { value: 'series', emoji: '📺', title: 'A series episode', sub: 'I am in a binge mood' }, { value: 'any', emoji: '♾️', title: 'No time limit', sub: 'Just find the right thing' },
  ] },
  { key: 'company', eyebrow: '04 / WHO IS WATCHING?', title: 'Who is joining you?', subtitle: 'A little context helps us avoid the wrong pick.', choices: [
    { value: 'solo', emoji: '🧘', title: 'Just me', sub: 'My own little cinema' }, { value: 'date', emoji: '🫶', title: 'Date night', sub: 'Two people, one screen' },
    { value: 'friends', emoji: '🥂', title: 'Friends', sub: 'A shared watch' }, { value: 'family', emoji: '👨‍👩‍👧‍👦', title: 'Family', sub: 'Keep it family-friendly' },
  ] },
  { key: 'vibe', eyebrow: '05 / THE VIBE', title: 'Pick the atmosphere.', subtitle: 'The final detail that makes this feel like your night.', choices: [
    { value: 'light', emoji: '☀️', title: 'Bright & easy', sub: 'Light-hearted and uplifting' }, { value: 'dark', emoji: '🌒', title: 'Dark & gritty', sub: 'Moody, tense, atmospheric' },
    { value: 'epic', emoji: '🏔️', title: 'Big & cinematic', sub: 'Grand worlds and scale' }, { value: 'clever', emoji: '🧠', title: 'Smart & layered', sub: 'Details worth decoding' },
    { value: 'heartfelt', emoji: '💌', title: 'Human & heartfelt', sub: 'Characters that stay with me' }, { value: 'weird', emoji: '🌀', title: 'Strange & surreal', sub: 'A little outside the box' },
    { value: 'grounded', emoji: '🎞️', title: 'Real & raw', sub: 'Stories that feel lived-in' },
  ] },
];
const LANGUAGES = [['any','No preference'],['en','English'],['hi','Hindi'],['ml','Malayalam'],['ta','Tamil'],['te','Telugu'],['kn','Kannada'],['ja','Japanese'],['ko','Korean'],['es','Spanish'],['fr','French'],['de','German'],['it','Italian'],['zh','Chinese'],['pt','Portuguese'],['ar','Arabic'],['tr','Turkish'],['bn','Bengali']] as const;
const WISHLIST_KEY = 'reelradar-wishlist-v1';
const LAST_KEY = 'reelradar-vibeflix-last-v1';
const SEEN_KEY = 'reelradar-vibeflix-seen-v1';
const DEFAULT_ANSWERS: Answers = { mood: 'happy', outcome: 'laugh', format: 'feature', company: 'solo', vibe: 'light', language: 'any', region: 'IN' };

function readList(key: string): any[] { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function getWatchUrl(provider: string, title: string, fallback: string | null) {
  const q = encodeURIComponent(title), n = provider.toLowerCase();
  if (n.includes('netflix')) return `https://www.netflix.com/search?q=${q}`;
  if (n.includes('prime video') || n.includes('amazon prime')) return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`;
  if (n.includes('disney')) return `https://www.disneyplus.com/search?q=${q}`;
  if (n.includes('apple tv')) return `https://tv.apple.com/search?term=${q}`;
  if (n.includes('hotstar')) return `https://www.hotstar.com/in/search?q=${q}`;
  if (n.includes('zee5')) return `https://www.zee5.com/search?q=${q}`;
  if (n.includes('sonyliv')) return `https://www.sonyliv.com/search?q=${q}`;
  return fallback ?? `https://www.google.com/search?q=${encodeURIComponent(`${title} ${provider} streaming`)}`;
}

export default function VibeFlixPage() {
  const [screen, setScreen] = useState<'intro'|'quiz'|'matching'|'result'>('intro');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wishlisted, setWishlisted] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const question = QUESTIONS[step];

  useEffect(() => {
    setSeen(readList(SEEN_KEY).map(String));
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      if (saved?.match?.id && saved?.match?.title) { setResult(saved as Result); setScreen('result'); }
    } catch { /* Ignore an outdated or malformed saved recommendation. */ }
  }, []);
  useEffect(() => { if (result) { try { localStorage.setItem(LAST_KEY, JSON.stringify(result)); } catch {} } }, [result]);
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const requestMatch = useCallback(async (nextAnswers: Answers, excluded: string[] = []) => {
    setError(''); setLoading(true); setScreen('matching');
    try {
      const response = await fetch('/api/vibeflix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: nextAnswers, exclude: excluded }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not find a match. Please try again.');
      const next = data as Result;
      if (!next.match?.id || !next.match?.title) throw new Error('TMDB returned an incomplete recommendation. Please try again.');
      setResult(next);
      const newKeys = [next.match, ...(next.runnersUp ?? [])].map(item => `${item.mediaType}:${item.id}`);
      setSeen(current => { const updated = [...new Set([...current, ...newKeys])].slice(-100); try { localStorage.setItem(SEEN_KEY, JSON.stringify(updated)); } catch {} return updated; });
      setWishlisted(readList(WISHLIST_KEY).some((x: any) => x.id === next.match.id && x.mediaType === next.match.mediaType));
      setScreen('result');
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setScreen('quiz'); }
    finally { setLoading(false); }
  }, []);

  const start = () => { setAnswers(DEFAULT_ANSWERS); setStep(0); setError(''); setResult(null); setScreen('quiz'); };
  const choose = (value: string) => {
    const updated = { ...answers, [question.key]: value };
    setAnswers(updated);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = setTimeout(() => {
      if (step < QUESTIONS.length - 1) setStep(s => s + 1);
      else void requestMatch(updated, seen);
    }, 260);
  };
  const surprise = () => {
    const random = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const next: Answers = { mood: random(['happy','sad','stressed','curious','adventurous','scared','romantic','bored']), outcome: random(['laugh','escape','think','cry','adrenaline','comfort','surprise']), format: random(['short','feature','series','any']), company: random(['solo','date','friends','family']), vibe: random(['light','dark','epic','clever','heartfelt','weird','grounded']), language: answers.language, region: answers.region };
    setAnswers(next); void requestMatch(next, seen);
  };
  const another = () => { if (!result) return; void requestMatch(answers, seen); };
  const toggleWishlist = () => {
    if (!result) return;
    const item = result.match;
    const rows = readList(WISHLIST_KEY);
    const exists = rows.some((x: any) => x.id === item.id && x.mediaType === item.mediaType);
    const next = exists ? rows.filter((x: any) => !(x.id === item.id && x.mediaType === item.mediaType)) : [{
      id: item.id, mediaType: item.mediaType, title: item.title, overview: item.overview, poster: item.poster,
      backdrop: item.backdrop, releaseDate: item.releaseDate, year: item.year, rating: item.rating,
      language: item.language, genres: item.genres, trailerKey: item.trailerKey, trailerThumb: item.trailerKey ? `https://img.youtube.com/vi/${item.trailerKey}/hqdefault.jpg` : null,
      providers: item.providers, watchLink: item.watchLink,
    }, ...rows];
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(next)); } catch {}
    setWishlisted(!exists);
  };
  const share = async () => {
    if (!result) return;
    const url = `${window.location.origin}/vibeflix`;
    const text = `My VibeFlix pick: ${result.match.title} (${result.match.year || 'new discovery'}). Find your movie mood on ReelRadar.`;
    try {
      if (navigator.share) await navigator.share({ title: `VibeFlix: ${result.match.title}`, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch (e) { if (e instanceof Error && e.name !== 'AbortError') setError('Could not share this result.'); }
  };
  const back = () => { if (advanceRef.current) clearTimeout(advanceRef.current); if (step > 0) setStep(s => s - 1); else setScreen('intro'); };
  const trailerUrl = result?.match.trailerKey ? `https://www.youtube.com/watch?v=${result.match.trailerKey}` : result ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${result.match.title} official trailer`)}` : '';
  const progress = useMemo(() => ((step + 1) / QUESTIONS.length) * 100, [step]);

  return <main className="vf-page">
    <div className="vf-shell">
    <header className="page-header">
  <a href="/" className="page-header-brand" aria-label="REELRADAR Home">
    <span className="page-header-brand-icon">
      <Clapperboard size={20} />
    </span>
    <span>REEL<span>RADAR</span></span>
  </a>

  <a href="/" className="page-header-back">
    <ArrowUpRight size={15} />
    Back to Discover
  </a>
</header>
      {screen === 'intro' && <section className="vf-hero">
        <div className="vf-orb">🎬</div><span className="vf-kicker">YOUR MOOD. YOUR MOVIE.</span><h1>FIND YOUR<br/><span>VIBE.</span></h1>
        <p>Not sure what to watch? Tell us how you feel, what kind of night you want, and we will find a movie or series that fits. No endless scrolling. Just your next favourite.</p>
        <div className="vf-actions"><button className="vf-btn primary" onClick={start}>Start the vibe check <ArrowRight size={16}/></button><button className="vf-btn" onClick={surprise}><Shuffle size={15}/> Surprise me</button></div>
        <div className="vf-footnote">5 QUICK QUESTIONS · PERSONALIZED PICKS · FREE TO USE</div>
      </section>}
      {screen === 'quiz' && <section className="vf-quiz">
        <div className="vf-quiz-top"><button className="vf-text-btn" onClick={back}><ChevronLeft size={16}/> Back</button><span className="vf-step-label">QUESTION {step + 1} OF {QUESTIONS.length}</span><button className="vf-text-btn" onClick={surprise}>Surprise me <Shuffle size={14}/></button></div>
        <div className="vf-progress"><span style={{ width: `${progress}%` }}/></div>
        <div className="vf-question" key={question.key}><span className="vf-kicker">{question.eyebrow}</span><h2>{question.title}</h2><p>{question.subtitle}</p>
          <div className="vf-options">{question.choices.map(choice => <button type="button" className={`vf-option ${answers[question.key] === choice.value ? 'selected' : ''}`} key={choice.value} onClick={() => choose(choice.value)}>
            <span className="vf-emoji">{choice.emoji}</span><strong>{choice.title}</strong>{choice.sub && <small>{choice.sub}</small>}{answers[question.key] === choice.value && <Check className="vf-check" size={16}/>}
          </button>)}</div>
        </div>
        <div className="vf-language"><label htmlFor="vf-language">OPTIONAL · ANY LANGUAGE PREFERENCE?</label><select id="vf-language" value={answers.language} onChange={e => setAnswers(a => ({ ...a, language: e.target.value }))}>{LANGUAGES.map(([code,label]) => <option value={code} key={code}>{label}</option>)}</select></div>
        {error && <div className="vf-error" role="alert">{error} <button className="vf-text-btn" onClick={() => void requestMatch(answers, seen)}>Try again <ArrowRight size={13}/></button></div>}
        <div className="vf-quiz-bottom"><span className="vf-step-label">YOUR ANSWERS SHAPE THE MATCH</span><button className="vf-text-btn" onClick={() => { setAnswers(DEFAULT_ANSWERS); setStep(0); }}>Reset answers <RotateCcw size={13}/></button></div>
      </section>}
      {screen === 'matching' && <section className="vf-matching"><div><div className="vf-loader"><span>🍿</span></div><span className="vf-kicker">READING YOUR VIBE</span><h2>Finding your kind of story…</h2><p>Matching your mood with movies and series from TMDB.</p><div style={{ marginTop: 24 }}><LoaderCircle size={17} className="vf-spin-icon"/></div></div></section>}
      {screen === 'result' && result && <section className="vf-result">
        <div className="vf-result-head"><div><span className="vf-kicker">YOUR VIBEFLIX MATCH</span><h2>Tonight, press play on this.</h2></div><button className="vf-text-btn vf-retake-btn" onClick={start}><RotateCcw size={14} className="vf-retake-icon"/><span>Retake quiz</span></button></div>
        <div className="vf-result-grid">
          <div className="vf-poster-wrap">{result.match.poster ? <img src={result.match.poster} alt={`${result.match.title} poster`}/> : <div className="vf-poster-fallback">🎬</div>}<div className="vf-match-ring"><strong>{result.matchPercent}%</strong><small>MATCH</small></div></div>
          <div className="vf-copy"><span className="vf-type"><Sparkles size={13}/> {result.match.mediaType === 'tv' ? 'SERIES PICK' : 'MOVIE PICK'}</span><h3>{result.match.title}</h3>
            <div className="vf-meta">{result.match.year && <span>{result.match.year}</span>}<span>{result.match.mediaType === 'tv' ? 'TV Series' : result.match.runtime ? `${result.match.runtime} min` : 'Feature film'}</span>{result.match.rating !== null && <span className="rating"><Star size={12} fill="currentColor"/> {result.match.rating.toFixed(1)} / 10</span>}</div>
            <p className="vf-overview">{result.match.overview || 'A story worth discovering. Open the trailer to get a feel for this pick.'}</p>
            <div className="vf-why"><strong>WHY THIS MATCHES YOUR VIBE</strong><div className="vf-reasons">{result.match.reasons.map(reason => <span key={reason}>{reason}</span>)}</div></div>
            <div className="vf-provider-title">WHERE TO WATCH {result.match.providers.length > 0 ? '· YOUR REGION' : ''}</div>
            {result.match.providers.length ? <div className="vf-providers">{result.match.providers.map(p => <a className="vf-provider" key={p.id} href={getWatchUrl(p.name, result.match.title, result.match.watchLink)} target="_blank" rel="noopener noreferrer">{p.logo && <img src={p.logo} alt=""/>}{p.name}<ExternalLink size={11}/></a>)}</div> : <div className="vf-empty">Streaming availability was not returned for your region. Check TMDB for current options.</div>}
            <div className="vf-result-actions"><a className="vf-btn primary" href={trailerUrl} target="_blank" rel="noreferrer"><Play size={15} fill="currentColor"/> Watch trailer <ExternalLink size={13}/></a><button className="vf-btn" onClick={toggleWishlist}><Heart size={15} fill={wishlisted ? 'currentColor' : 'none'} color={wishlisted ? '#dfff00' : 'currentColor'}/>{wishlisted ? 'Saved to wishlist' : 'Add to wishlist'}</button><button className="vf-btn" onClick={share}><Share2 size={15}/>{copied ? 'Copied!' : 'Share pick'}</button><button className="vf-btn" onClick={another} disabled={loading}><Shuffle size={15}/> Try another</button></div>
          </div>
        </div>
        {result.runnersUp.length > 0 && <><div className="vf-runner-title"><h3>More picks for your vibe</h3><span>ALSO MATCHED FOR YOU</span></div><div className="vf-runners">{result.runnersUp.map(item => <article className="vf-runner" key={`${item.mediaType}:${item.id}`}>{item.poster ? <img src={item.poster} alt={`${item.title} poster`} loading="lazy"/> : <div className="vf-empty">Poster unavailable</div>}<div className="vf-runner-copy"><strong>{item.title}</strong><small>{item.year || 'Release date unavailable'} · {item.mediaType === 'tv' ? 'Series' : 'Movie'}{item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ''}</small></div></article>)}</div></>}
        <div className="vf-result-actions" style={{ marginTop: 30 }}><button className="vf-btn primary" onClick={another}><Shuffle size={15}/> Find another match</button><button className="vf-btn" onClick={start}><RotateCcw size={15}/> Start over</button></div>
      </section>}
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
    </div>
  </main>;
}
