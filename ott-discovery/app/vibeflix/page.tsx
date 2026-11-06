'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Clock3, ExternalLink, Heart, LoaderCircle, Play, RotateCcw, Share2, Shuffle, Sparkles, Star, Users, X } from 'lucide-react';

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
    <style jsx global>{`
      .vf-page{min-height:100vh;background:#08090d;color:#f7f8fb;font-family:inherit;padding:0 0 64px;overflow:hidden;position:relative}.vf-page:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 8%,rgba(223,255,0,.09),transparent 42%),radial-gradient(ellipse at 90% 75%,rgba(111,77,255,.08),transparent 35%);z-index:0}.vf-shell{position:relative;z-index:1;width:min(1120px,calc(100% - 40px));margin:0 auto}.vf-nav{height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08)}.vf-brand{font-size:12px;font-weight:900;letter-spacing:2px;color:#f7f8fb;text-decoration:none}.vf-brand b{color:#dfff00}.vf-nav a.back{color:#aab0bd;text-decoration:none;font-size:12px;display:flex;align-items:center;gap:8px}.vf-nav a:hover{color:#dfff00}.vf-kicker{color:#dfff00;font-size:10px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase}.vf-hero{text-align:center;max-width:780px;margin:0 auto;padding:clamp(70px,13vh,145px) 0 80px}.vf-orb{width:100px;height:100px;border-radius:30px;margin:0 auto 30px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(223,255,0,.18),rgba(223,255,0,.025));border:1px solid rgba(223,255,0,.35);box-shadow:0 0 70px rgba(223,255,0,.12),inset 0 0 25px rgba(223,255,0,.07);font-size:43px;animation:vf-float 4s ease-in-out infinite}.vf-hero h1{font-size:clamp(48px,9vw,92px);line-height:.96;letter-spacing:-.075em;margin:15px 0 20px;font-weight:950}.vf-hero h1 span{color:#dfff00}.vf-hero p{max-width:560px;margin:0 auto;color:#aab0bd;font-size:15px;line-height:1.8}.vf-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:34px}.vf-btn{min-height:48px;padding:0 21px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#fff;font:inherit;font-size:12px;font-weight:850;letter-spacing:.3px;display:inline-flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;text-decoration:none;transition:transform .18s,border-color .18s,background .18s}.vf-btn:hover{transform:translateY(-2px);border-color:rgba(223,255,0,.55)}.vf-btn.primary{background:#dfff00;color:#090a0d;border-color:#dfff00;box-shadow:0 8px 28px rgba(223,255,0,.15)}.vf-btn.primary:hover{background:#e9ff56}.vf-footnote{margin-top:28px;color:#737b89;font-size:10px;letter-spacing:.3px}.vf-quiz{max-width:900px;margin:0 auto;padding:48px 0 20px;min-height:calc(100vh - 100px)}.vf-quiz-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.vf-step-label{font-size:10px;color:#9da5b4;font-weight:800;letter-spacing:1.3px}.vf-progress{height:4px;background:#1b2029;border-radius:10px;overflow:hidden;margin-bottom:50px}.vf-progress span{display:block;height:100%;background:#dfff00;border-radius:10px;transition:width .35s ease;box-shadow:0 0 16px rgba(223,255,0,.6)}.vf-question{text-align:center;animation:vf-enter .35s ease both}.vf-question h2{font-size:clamp(30px,5vw,48px);letter-spacing:-2px;margin:13px 0 9px}.vf-question>p{color:#9da5b4;font-size:13px;margin:0 0 34px}.vf-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;text-align:left}.vf-option{position:relative;min-height:142px;padding:18px 16px;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));color:#fff;text-align:left;cursor:pointer;transition:transform .2s,border-color .2s,background .2s;display:flex;flex-direction:column;align-items:flex-start}.vf-option:hover{transform:translateY(-3px);border-color:rgba(223,255,0,.45);background:rgba(223,255,0,.055)}.vf-option.selected{border-color:#dfff00;background:rgba(223,255,0,.09);box-shadow:0 0 0 1px rgba(223,255,0,.15),0 10px 35px rgba(0,0,0,.2)}.vf-emoji{font-size:27px;margin-bottom:13px}.vf-option strong{font-size:13px;line-height:1.3}.vf-option small{color:#929aa8;font-size:10px;line-height:1.45;margin-top:5px}.vf-check{position:absolute;right:12px;top:12px;color:#dfff00}.vf-quiz-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:28px}.vf-text-btn{background:none;border:0;color:#aab0bd;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;padding:9px 0}.vf-text-btn:hover{color:#dfff00}.vf-language{margin:32px auto 0;max-width:390px;text-align:center}.vf-language label{display:block;font-size:10px;color:#aab0bd;margin-bottom:8px}.vf-language select{width:100%;height:44px;background:#11141c;color:#fff;border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:0 12px;font:inherit;font-size:12px}.vf-error{margin:18px auto 0;max-width:650px;padding:13px 15px;border:1px solid rgba(255,105,105,.3);background:rgba(255,70,70,.07);border-radius:10px;color:#ffb3b3;font-size:12px;line-height:1.5}.vf-matching{min-height:70vh;display:flex;align-items:center;justify-content:center;text-align:center}.vf-loader{width:112px;height:112px;border-radius:50%;margin:0 auto 28px;border:1px solid rgba(223,255,0,.2);display:grid;place-items:center;position:relative;box-shadow:0 0 60px rgba(223,255,0,.1)}.vf-loader:before,.vf-loader:after{content:"";position:absolute;inset:-9px;border:2px solid transparent;border-top-color:#dfff00;border-radius:50%;animation:vf-spin 1.1s linear infinite}.vf-loader:after{inset:8px;border-top-color:rgba(223,255,0,.45);animation-duration:1.7s;animation-direction:reverse}.vf-loader span{font-size:37px}.vf-matching h2{font-size:32px;letter-spacing:-1px;margin:0 0 9px}.vf-matching p{font-size:12px;color:#9da5b4}.vf-result{padding:42px 0 25px;animation:vf-enter .45s ease both}.vf-result-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:22px}.vf-result-head h2{font-size:clamp(25px,4vw,38px);letter-spacing:-1.6px;margin:6px 0 0}.vf-result-grid{display:grid;grid-template-columns:minmax(220px,340px) minmax(0,1fr);gap:30px;align-items:stretch}.vf-poster-wrap{position:relative;border-radius:18px;overflow:hidden;min-height:440px;background:#151923;border:1px solid rgba(255,255,255,.1);box-shadow:0 22px 70px rgba(0,0,0,.38)}.vf-poster-wrap>img{width:100%;height:100%;min-height:440px;object-fit:cover;display:block}.vf-poster-fallback{height:100%;min-height:440px;display:grid;place-items:center;font-size:64px;color:#dfff00}.vf-match-ring{position:absolute;top:15px;left:15px;width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:rgba(8,9,13,.88);border:2px solid #dfff00;box-shadow:0 0 28px rgba(223,255,0,.2);text-align:center;backdrop-filter:blur(10px)}.vf-match-ring strong{font-size:20px;line-height:1}.vf-match-ring small{font-size:7px;color:#dfff00;font-weight:900;letter-spacing:1px;margin-top:-13px}.vf-copy{padding:8px 0}.vf-type{display:inline-flex;align-items:center;gap:6px;color:#dfff00;font-size:9px;font-weight:900;letter-spacing:1.5px}.vf-copy h3{font-size:clamp(31px,4vw,48px);letter-spacing:-2px;line-height:1.04;margin:12px 0}.vf-meta{display:flex;align-items:center;gap:13px;flex-wrap:wrap;color:#aab0bd;font-size:11px}.vf-meta span{display:inline-flex;align-items:center;gap:5px}.vf-meta .rating{color:#f5d36b}.vf-overview{font-size:13px;line-height:1.8;color:#c2c7d1;margin:23px 0}.vf-why{padding:16px 17px;border:1px solid rgba(223,255,0,.18);background:linear-gradient(120deg,rgba(223,255,0,.07),rgba(255,255,255,.02));border-radius:13px}.vf-why strong{display:block;font-size:10px;color:#dfff00;letter-spacing:1.2px;margin-bottom:11px}.vf-reasons{display:flex;flex-wrap:wrap;gap:7px}.vf-reasons span{padding:7px 9px;border-radius:7px;background:rgba(255,255,255,.055);color:#d4d8e0;font-size:10px}.vf-provider-title{margin:22px 0 10px;font-size:10px;letter-spacing:1.2px;color:#9da5b4;font-weight:900}.vf-providers{display:flex;flex-wrap:wrap;gap:8px}.vf-provider{display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border-radius:9px;background:#141821;border:1px solid rgba(255,255,255,.1);color:#e9ebef;text-decoration:none;font-size:10px}.vf-provider img{width:19px;height:19px;border-radius:5px}.vf-provider:hover{border-color:#dfff00}.vf-result-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.vf-runner-title{display:flex;align-items:center;justify-content:space-between;margin:36px 0 13px}.vf-runner-title h3{font-size:15px;margin:0}.vf-runner-title span{font-size:9px;color:#8f97a6;letter-spacing:1px}.vf-runners{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.vf-runner{border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:#11141b}.vf-runner img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block}.vf-runner-copy{padding:10px}.vf-runner strong{display:block;font-size:11px;line-height:1.35}.vf-runner small{display:block;color:#9da5b4;font-size:9px;margin-top:5px}.vf-footer{margin-top:45px;padding-top:17px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;color:#8b93a1;font-size:9px;text-align:center}.vf-footer img{width:72px;opacity:.9}.vf-empty{padding:20px;border:1px dashed rgba(255,255,255,.15);border-radius:12px;color:#aab0bd;font-size:12px}.vf-page button:focus-visible,.vf-page a:focus-visible,.vf-page select:focus-visible{outline:2px solid #dfff00;outline-offset:3px}
      @keyframes vf-spin{to{transform:rotate(360deg)}}@keyframes vf-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes vf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      @media(max-width:760px){.vf-shell{width:calc(100% - 28px)}.vf-nav{height:58px}.vf-hero{padding:90px 0 65px}.vf-hero p{font-size:13px}.vf-quiz{padding-top:30px}.vf-progress{margin-bottom:36px}.vf-options{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.vf-option{min-height:126px;padding:14px}.vf-emoji{font-size:24px;margin-bottom:10px}.vf-option strong{font-size:12px}.vf-result{padding-top:25px}.vf-result-grid{grid-template-columns:minmax(0,1fr);gap:20px}.vf-poster-wrap{width:min(100%,340px);margin:0 auto;min-height:0;aspect-ratio:2/3}.vf-poster-wrap>img,.vf-poster-fallback{min-height:0}.vf-copy{padding:0}.vf-copy h3{font-size:36px}.vf-runners{grid-template-columns:repeat(2,minmax(0,1fr))}.vf-runner-title{margin-top:28px}.vf-result-head{align-items:flex-start}.vf-result-head h2{font-size:27px}}
      @media(max-width:390px){.vf-option{min-height:118px;padding:12px}.vf-option small{font-size:9px}.vf-question h2{font-size:29px}.vf-result-actions .vf-btn{flex:1 1 44%}}
      @media(prefers-reduced-motion:reduce){.vf-page *{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `}</style>
    <div className="vf-shell">
      <header className="vf-nav"><Link className="vf-brand" href="/">REELRADAR <b>×</b> VIBEFLIX</Link><Link className="back" href="/"><ArrowLeft size={15}/> Back to ReelRadar</Link></header>
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
        <div className="vf-result-head"><div><span className="vf-kicker">YOUR VIBEFLIX MATCH</span><h2>Tonight, press play on this.</h2></div><button className="vf-text-btn" onClick={start}><RotateCcw size={14}/> Retake quiz</button></div>
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
      <footer className="vf-footer"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue.svg" alt="TMDB"/><span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span><span>·</span><span>Recommendations are generated from your quiz answers.</span></footer>
    </div>
  </main>;
}
