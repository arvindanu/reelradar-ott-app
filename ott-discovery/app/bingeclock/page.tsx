'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Film, Hourglass, Search, Share2, Sparkles, Tv, X } from 'lucide-react';

type Mode = 'collection' | 'series';
type SearchItem = { id: number; title: string; overview: string; poster: string | null; backdrop: string | null; year: string; mediaType: string };
type WatchItem = { id: number; key: string; title: string; label: string; runtime: number; releaseDate: string; poster: string | null; type: 'movie' | 'episode' };
type PlanData = { selection: { id: number; type: Mode; title: string; poster: string | null; overview: string }; items: WatchItem[]; missingRuntimeCount: number; stats: { seasons: number; titles: number; totalMinutes: number; averageMinutes: number } };
type DayPlan = { date: string; items: WatchItem[]; minutes: number };

const PROGRESS_PREFIX = 'reelradar-bingeclock-v1';
const WEEKDAYS = [{ label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 }];
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (value: string, amount: number) => { const date = parseDate(value); date.setDate(date.getDate() + amount); return localDate(date); };
const prettyDate = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => parseDate(value).toLocaleDateString(undefined, options);
const formatTime = (minutes: number) => { const hours = Math.floor(minutes / 60); const mins = minutes % 60; return hours ? `${hours}h ${mins ? `${mins}m` : ''}`.trim() : `${mins}m`; };

function buildSchedule(items: WatchItem[], start: string, deadline: string, dailyMinutes: number, excluded: number[]) {
  const days: DayPlan[] = [];
  let cursor = 0;
  let date = start;
  let guard = 0;
  while (cursor < items.length && date <= deadline && guard++ < 4000) {
    const weekday = parseDate(date).getDay();
    if (!excluded.includes(weekday)) {
      const dayItems: WatchItem[] = [];
      let minutes = 0;
      while (cursor < items.length) {
        const next = items[cursor];
        if (dayItems.length && minutes + next.runtime > dailyMinutes) break;
        dayItems.push(next);
        minutes += next.runtime;
        cursor++;
        if (minutes >= dailyMinutes) break;
      }
      if (dayItems.length) days.push({ date, items: dayItems, minutes });
    }
    date = addDays(date, 1);
  }
  const deadlineDays = days.length;
  while (cursor < items.length && guard++ < 8000) {
    const weekday = parseDate(date).getDay();
    if (!excluded.includes(weekday)) {
      const dayItems: WatchItem[] = [];
      let minutes = 0;
      while (cursor < items.length) {
        const next = items[cursor];
        if (dayItems.length && minutes + next.runtime > dailyMinutes) break;
        dayItems.push(next); minutes += next.runtime; cursor++;
        if (minutes >= dailyMinutes) break;
      }
      if (dayItems.length) days.push({ date, items: dayItems, minutes });
    }
    date = addDays(date, 1);
  }
  return { days, deadlineDays, complete: cursor === items.length };
}

function encodeShare(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeShare(value: string) {
  try { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const binary = atob(normalized); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

export default function BingeClockPage() {
  const today = useMemo(() => localDate(new Date()), []);
  const [mode, setMode] = useState<Mode>('collection');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selection, setSelection] = useState<SearchItem | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [deadline, setDeadline] = useState(addDays(today, 14));
  const [dailyHours, setDailyHours] = useState(2);
  const [excludedDays, setExcludedDays] = useState<number[]>([]);
  const [skipSpecials, setSkipSpecials] = useState(true);
  const [skipUnaired, setSkipUnaired] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [progressReady, setProgressReady] = useState(false);
  const [shareNotice, setShareNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('share');
    if (!shared) return;
    const data = decodeShare(shared);
    if (!data || !Number.isInteger(data.id)) return;
    setMode(data.type === 'series' ? 'series' : 'collection');
    setDeadline(typeof data.deadline === 'string' ? data.deadline : addDays(today, 14));
    setDailyHours(Math.min(12, Math.max(1, Number(data.dailyHours) || 2)));
    setExcludedDays(Array.isArray(data.excludedDays) ? data.excludedDays : []);
    setSkipSpecials(data.skipSpecials !== false);
    setSkipUnaired(data.skipUnaired !== false);
    const sharedSelection: SearchItem = { id: data.id, title: data.title || 'Shared watch plan', overview: '', poster: data.poster || null, backdrop: null, year: '', mediaType: data.type === 'series' ? 'tv' : 'collection' };
    setSelection(sharedSelection);
    window.history.replaceState({}, '', '/bingeclock');
  }, [today]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selection) { setResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true); setSearchError('');
      try {
        const response = await fetch(`/api/bingeclock?type=${mode}&query=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search is temporarily unavailable.');
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : 'Could not search TMDB.');
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 320);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, mode, selection]);

  const loadPlan = useCallback(async (selected: SearchItem) => {
    setLoadingPlan(true); setPlanError(''); setPlan(null); setDone([]); setProgressReady(false);
    try {
      const response = await fetch('/api/bingeclock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: mode, id: selected.id, skipSpecials, skipUnaired }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not build this watch plan.');
      setPlan(data as PlanData);
    } catch (error) { setPlanError(error instanceof Error ? error.message : 'TMDB could not finish loading this plan.'); }
    finally { setLoadingPlan(false); }
  }, [mode, skipSpecials, skipUnaired]);

  useEffect(() => { if (selection) void loadPlan(selection); }, [selection, loadPlan]);

  const progressKey = plan ? `${PROGRESS_PREFIX}:${plan.selection.type}:${plan.selection.id}` : '';
  useEffect(() => {
    if (!progressKey || !plan) return;
    try {
      const stored = localStorage.getItem(progressKey);
      setDone(stored ? JSON.parse(stored) : []);
    } catch { setDone([]); }
    setProgressReady(true);
  }, [progressKey, plan]);
  useEffect(() => {
    if (progressReady && progressKey) { try { localStorage.setItem(progressKey, JSON.stringify(done)); } catch { /* Keep progress for this session if storage is unavailable. */ } }
  }, [done, progressKey, progressReady]);

  const schedule = useMemo(() => plan ? buildSchedule(plan.items, startDate, deadline, dailyHours * 60, excludedDays) : null, [plan, startDate, deadline, dailyHours, excludedDays]);
  const availableDays = useMemo(() => {
    if (deadline < startDate) return 0;
    let count = 0;
    for (let date = startDate, guard = 0; date <= deadline && guard < 4000; date = addDays(date, 1), guard++) if (!excludedDays.includes(parseDate(date).getDay())) count++;
    return count;
  }, [startDate, deadline, excludedDays]);
  const totalMinutes = plan?.stats.totalMinutes ?? 0;
  const requiredHours = availableDays ? totalMinutes / availableDays / 60 : Infinity;
  const deadlineSchedule = schedule?.days.filter(day => day.date <= deadline) ?? [];
  const scheduledCount = deadlineSchedule.reduce((sum, day) => sum + day.items.length, 0);
  const scheduleOverLimit = deadlineSchedule.some(day => day.minutes > dailyHours * 60);
  const achievable = Boolean(plan && availableDays > 0 && scheduledCount >= plan.items.length && !scheduleOverLimit);
  const finishDay = schedule?.days.find(day => day.items.some(item => item.key === plan?.items[plan.items.length - 1]?.key))?.date ?? null;
  const bufferDays = finishDay && deadline >= finishDay ? Math.round((parseDate(deadline).getTime() - parseDate(finishDay).getTime()) / 86400000) : 0;
  const utilization = Number.isFinite(requiredHours) && dailyHours ? requiredHours / dailyHours : Infinity;
  const feasibility = !achievable ? 'Not possible' : utilization < .5 ? 'Easy' : utilization < .75 ? 'Comfortable' : 'Tight';
  const completedCount = plan ? plan.items.filter(item => done.includes(item.key)).length : 0;
  const progressPercent = plan?.items.length ? Math.round(completedCount / plan.items.length * 100) : 0;
  const paceCount = availableDays ? Math.ceil((plan?.items.length ?? 0) / availableDays) : 0;
  const headline = plan ? (mode === 'series' ? `Watch ${paceCount} ${paceCount === 1 ? 'episode' : 'episodes'} a day` : `Watch ${paceCount} ${paceCount === 1 ? 'movie' : 'movies'} a day`) : '';

  const selectItem = (item: SearchItem) => { setSelection(item); setQuery(''); setResults([]); };
  const resetSelection = () => { setSelection(null); setPlan(null); setPlanError(''); setQuery(''); setResults([]); };
  const toggleDone = (key: string) => setDone(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  const sharePlan = async () => {
    if (!plan) return;
    const payload = { id: plan.selection.id, type: plan.selection.type, title: plan.selection.title, poster: plan.selection.poster, deadline, dailyHours, excludedDays, skipSpecials, skipUnaired };
    const url = `${window.location.origin}/bingeclock?share=${encodeShare(payload)}`;
    const text = `${plan.selection.title} BingeClock plan: ${headline}, ${formatTime(totalMinutes)} total. Finish by ${prettyDate(deadline, { month: 'short', day: 'numeric', year: 'numeric' })}.`;
    try {
      if (navigator.share) await navigator.share({ title: `${plan.selection.title} · BingeClock`, text, url });
      else { await navigator.clipboard.writeText(url); setShareNotice('Share link copied.'); }
    } catch (error) { if (error instanceof Error && error.name !== 'AbortError') setShareNotice('Could not share right now.'); }
  };
  const addCalendar = () => {
    if (!schedule || !plan) return;
    const events = schedule.days.map(day => {
      const title = `${plan.selection.title}: ${day.items.length} ${mode === 'series' ? 'episodes' : 'movies'}`;
      const description = day.items.map(item => `${item.label} — ${item.title} (${formatTime(item.runtime)})`).join('\\n');
      return `BEGIN:VEVENT\r\nUID:${plan.selection.id}-${day.date}@reelradar\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}\r\nDTSTART;VALUE=DATE:${day.date.replace(/-/g, '')}\r\nSUMMARY:${title.replace(/[,;]/g, ' ')}\r\nDESCRIPTION:${description.replace(/[,;]/g, ' ')}\r\nEND:VEVENT`;
    }).join('\r\n');
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//REELRADAR//BingeClock//EN\r\nCALSCALE:GREGORIAN\r\n${events}\r\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'bingeclock-plan.ics'; anchor.click(); URL.revokeObjectURL(href);
  };

  return <main className="bc-page">
    <style jsx global>{`
      .bc-page{min-height:100vh;background:#08090d;color:#f6f7fb;padding-bottom:55px;font-family:inherit}.bc-topbar{height:66px;padding:0 clamp(16px,4vw,56px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(8,9,13,.9);position:sticky;top:0;z-index:20;backdrop-filter:blur(18px)}.bc-brand{display:flex;align-items:center;gap:9px;color:#f6f7fb;text-decoration:none;font-size:12px;font-weight:850;letter-spacing:1.3px}.bc-brand b{color:#dfff00}.bc-brand-mark{width:30px;height:30px;border:1px solid rgba(223,255,0,.35);border-radius:9px;display:grid;place-items:center;color:#dfff00}.bc-back{display:inline-flex;align-items:center;gap:8px;color:#aeb3bf;text-decoration:none;font-size:12px;font-weight:700}.bc-back:hover{color:#dfff00}.bc-wrap{width:min(1120px,calc(100% - 40px));margin:0 auto}.bc-hero{padding:46px 0 22px}.bc-kicker{display:inline-flex;align-items:center;gap:8px;color:#dfff00;font-size:10px;font-weight:850;letter-spacing:2px}.bc-hero h1{font-size:clamp(38px,6vw,64px);letter-spacing:-2.5px;line-height:1;margin:12px 0 10px}.bc-hero h1 span{color:#dfff00}.bc-hero>p{max-width:720px;color:#b2b8c4;font-size:14px;line-height:1.7;margin:0}.bc-tagline{margin-top:12px;color:#858d9b;font-size:11px;letter-spacing:.06em}.bc-how{margin-top:22px;border:1px solid rgba(255,255,255,.1);border-radius:13px;background:rgba(255,255,255,.025);overflow:hidden}.bc-how summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;font-size:12px;font-weight:800}.bc-how summary::-webkit-details-marker{display:none}.bc-how summary svg{color:#dfff00}.bc-how p{margin:0;padding:0 16px 15px;color:#aeb5c2;font-size:12px;line-height:1.7}.bc-panel{border:1px solid rgba(255,255,255,.1);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));padding:22px;margin-top:20px}.bc-mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#0b0e14;width:min(100%,460px)}.bc-mode button{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 10px;border:0;border-radius:8px;background:transparent;color:#9da5b3;font-size:12px;font-weight:800;cursor:pointer}.bc-mode button.active{background:#dfff00;color:#10130a}.bc-field-label{display:block;color:#d8dce4;font-size:11px;font-weight:800;letter-spacing:.07em;margin:20px 0 9px}.bc-search{position:relative;display:flex;align-items:center;gap:10px;min-height:50px;padding:0 14px;border:1px solid rgba(255,255,255,.13);border-radius:11px;background:#0b0e14;color:#8f98a7}.bc-search input{width:100%;background:transparent;border:0;outline:0;color:#fff;font:inherit;font-size:13px}.bc-search-results{display:grid;gap:7px;margin-top:9px}.bc-search-result{display:flex;align-items:center;gap:12px;width:100%;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035);color:#fff;text-align:left;cursor:pointer}.bc-search-result:hover{border-color:rgba(223,255,0,.4)}.bc-search-result img{width:42px;height:58px;object-fit:cover;border-radius:6px;background:#1c222d}.bc-search-result span{min-width:0;display:flex;flex-direction:column;gap:5px}.bc-search-result strong{font-size:12px}.bc-search-result small{color:#8992a1;font-size:10px}.bc-selected{display:flex;align-items:center;gap:14px;margin-top:15px;padding:12px;border:1px solid rgba(223,255,0,.22);border-radius:12px;background:rgba(223,255,0,.045)}.bc-selected img{width:62px;height:88px;object-fit:cover;border-radius:8px;background:#1c222d}.bc-selected-copy{min-width:0;flex:1}.bc-selected-copy strong{display:block;font-size:14px}.bc-selected-copy p{margin:5px 0 0;color:#9da5b2;font-size:11px;line-height:1.5}.bc-clear{align-self:flex-start;border:0;background:transparent;color:#aeb5c2;padding:5px;cursor:pointer}.bc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.bc-date{width:100%;height:46px;padding:0 12px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#0b0e14;color:#fff;font:inherit;color-scheme:dark}.bc-quick{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.bc-quick button{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 11px;background:transparent;color:#aeb5c2;font-size:10px;font-weight:800;cursor:pointer}.bc-quick button:hover{border-color:#dfff00;color:#dfff00}.bc-range-row{display:flex;align-items:center;justify-content:space-between;gap:14px}.bc-range-row strong{color:#dfff00;font-size:16px}.bc-range{width:100%;accent-color:#dfff00;margin:14px 0 4px}.bc-muted{color:#858e9d;font-size:10px;line-height:1.6}.bc-weekdays{display:flex;gap:7px;flex-wrap:wrap}.bc-weekdays label{display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 10px;color:#b5bdc9;font-size:10px;cursor:pointer}.bc-weekdays input,.bc-check input{accent-color:#dfff00}.bc-options{display:grid;gap:11px;margin-top:20px;padding-top:17px;border-top:1px solid rgba(255,255,255,.08)}.bc-check{display:flex;align-items:center;gap:9px;color:#b7bfcb;font-size:11px}.bc-primary{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:0 20px;border:0;border-radius:10px;background:#dfff00;color:#11140a;font-size:12px;font-weight:900;cursor:pointer}.bc-primary:disabled{opacity:.45;cursor:not-allowed}.bc-error,.bc-empty{margin-top:14px;padding:14px;border:1px solid rgba(255,120,120,.2);border-radius:10px;background:rgba(255,90,90,.05);color:#e0a8a8;font-size:12px;line-height:1.6}.bc-empty{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.025);color:#aeb5c2}.bc-loading{color:#aeb5c2;font-size:12px;margin:14px 0}.bc-results{margin-top:26px}.bc-result-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:17px}.bc-result-top h2{font-size:clamp(22px,3.6vw,34px);line-height:1.2;margin:0 0 7px}.bc-result-top p{margin:0;color:#aeb5c2;font-size:12px}.bc-badge{display:inline-flex;white-space:nowrap;align-items:center;padding:8px 11px;border-radius:999px;background:rgba(223,255,0,.1);border:1px solid rgba(223,255,0,.24);color:#dfff00;font-size:10px;font-weight:900}.bc-badge.not{color:#ff9c9c;border-color:rgba(255,120,120,.3);background:rgba(255,90,90,.08)}.bc-stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.bc-stat{padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.025);min-width:0}.bc-stat span{display:block;color:#8791a0;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.bc-stat strong{display:block;color:#f5f6fa;font-size:19px;margin-top:8px;overflow-wrap:anywhere}.bc-stat small{display:block;color:#929baa;font-size:9px;margin-top:4px}.bc-ring-row{display:flex;align-items:center;gap:20px;margin:18px 0;padding:17px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.025)}.bc-ring{width:106px;height:106px;flex:0 0 106px;position:relative;display:grid;place-items:center}.bc-ring svg{position:absolute;inset:0;transform:rotate(-90deg)}.bc-ring circle{fill:none;stroke-width:8}.bc-ring .track{stroke:rgba(255,255,255,.09)}.bc-ring .value{stroke:#dfff00;stroke-linecap:round;transition:stroke-dashoffset .35s ease}.bc-ring-center{text-align:center}.bc-ring-center strong{display:block;font-size:18px}.bc-ring-center small{color:#929baa;font-size:9px}.bc-ring-copy strong{font-size:13px}.bc-ring-copy p{margin:6px 0 0;color:#9ca5b3;font-size:11px;line-height:1.6}.bc-actions{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0 23px}.bc-secondary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 13px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.035);color:#e2e5eb;font-size:11px;font-weight:800;cursor:pointer}.bc-secondary:hover{border-color:rgba(223,255,0,.4);color:#dfff00}.bc-progress{height:7px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:10px 0 20px}.bc-progress span{display:block;height:100%;border-radius:inherit;background:#dfff00;transition:width .3s ease}.bc-schedule-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.bc-schedule-head h3{margin:0;font-size:17px}.bc-schedule-head span{color:#929baa;font-size:10px}.bc-day{margin-top:10px;border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.02)}.bc-day-head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:rgba(255,255,255,.035);color:#dfe3eb;font-size:11px;font-weight:850}.bc-day-head small{color:#929baa;font-size:10px;font-weight:600}.bc-watch-item{display:flex;align-items:center;gap:11px;padding:10px 13px;border-top:1px solid rgba(255,255,255,.06)}.bc-watch-item img{width:34px;height:48px;object-fit:cover;border-radius:5px;background:#1c222d}.bc-watch-item input{accent-color:#dfff00;width:16px;height:16px;flex:0 0 auto}.bc-watch-copy{flex:1;min-width:0}.bc-watch-copy strong{display:block;font-size:11px;line-height:1.4}.bc-watch-copy small{display:block;margin-top:3px;color:#8e98a7;font-size:9px}.bc-watch-runtime{color:#cbd1dc;font-size:10px;white-space:nowrap}.bc-done .bc-watch-copy strong{text-decoration:line-through;color:#818a98}.bc-note{margin-top:13px;color:#8f98a7;font-size:10px;line-height:1.6}.bc-attribution{margin:44px auto 0;padding-top:17px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;color:#8992a1;font-size:10px;text-align:center}.bc-attribution img{width:78px;height:auto}.bc-toast{color:#dfff00;font-size:10px;align-self:center}
      @media(max-width:850px){.bc-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:600px){.bc-wrap{width:calc(100% - 28px)}.bc-topbar{height:58px}.bc-hero{padding:32px 0 16px}.bc-hero h1{font-size:43px}.bc-hero>p{font-size:12px}.bc-panel{padding:15px;margin-top:14px}.bc-grid{grid-template-columns:1fr;gap:0}.bc-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bc-stat{padding:11px}.bc-stat strong{font-size:17px}.bc-result-top{flex-direction:column}.bc-ring-row{gap:13px;padding:13px}.bc-ring{width:88px;height:88px;flex-basis:88px}.bc-ring svg{width:88px;height:88px}.bc-ring-center strong{font-size:15px}.bc-actions>*{flex:1}.bc-watch-item{padding:9px}.bc-watch-copy strong{font-size:10px}}
      @media(prefers-reduced-motion:reduce){.bc-ring .value,.bc-progress span{transition:none!important}}
    `}</style>
<header className="bc-topbar">
  <Link href="/" className="bc-back" aria-label="Back to Discover">
    <ArrowLeft size={18} />
  </Link>

  <Link href="/" className="bc-brand">
    REELRADAR
  </Link>
</header>
    <div className="bc-wrap">
      <section className="bc-hero"><span className="bc-kicker"><Hourglass size={14}/> YOUR WATCH-TIME PLANNER</span><h1>BINGE<span>CLOCK</span></h1><p>BingeClock tells you exactly how much to watch each day to finish a franchise or series before your deadline.</p><div className="bc-tagline">Less guessing. Better pacing. One episode at a time.</div>
        <details className="bc-how"><summary>How it works <ChevronDown size={16}/></summary><p>Choose a movie collection or TV series, set your deadline and daily watch time, then BingeClock builds a day-by-day plan from TMDB runtimes. Long movies and episodes stay together instead of being split between days. Tick off titles as you watch; progress is saved on this device.</p></details>
      </section>

      <section className="bc-panel">
        <div className="bc-mode" role="group" aria-label="Choose what to plan"><button type="button" className={mode === 'collection' ? 'active' : ''} onClick={() => { setMode('collection'); resetSelection(); }}><Film size={15}/> Movie Franchise</button><button type="button" className={mode === 'series' ? 'active' : ''} onClick={() => { setMode('series'); resetSelection(); }}><Tv size={15}/> Series</button></div>
        <label className="bc-field-label" htmlFor="bc-search">{mode === 'series' ? 'SEARCH TV SHOWS' : 'SEARCH MOVIE FRANCHISES'}</label>
        {!selection ? <div className="bc-search"><Search size={17}/><input id="bc-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={mode === 'series' ? 'Search a series, e.g. Breaking Bad…' : 'Search a franchise, e.g. Harry Potter…'} autoComplete="off"/><span>{searching ? 'Searching…' : ''}</span></div> : <div className="bc-selected">{selection.poster ? <img src={selection.poster} alt=""/> : <div className="bc-selected-placeholder"><Film/></div>}<div className="bc-selected-copy"><strong>{selection.title}</strong><p>{selection.year || (mode === 'series' ? 'TV series' : 'TMDB movie collection')} · {mode === 'series' ? 'Series' : 'Movie franchise'}</p></div><button className="bc-clear" onClick={resetSelection} aria-label="Choose another title" type="button"><X size={18}/></button></div>}
        {!selection && results.length > 0 && <div className="bc-search-results">{results.map(item => <button className="bc-search-result" type="button" key={item.id} onClick={() => selectItem(item)}>{item.poster ? <img src={item.poster} alt=""/> : <div/>}<span><strong>{item.title}</strong><small>{item.year || 'Year unavailable'} · {mode === 'series' ? 'TV series' : 'Movie collection'}</small></span><ArrowUpRight size={15}/></button>)}</div>}
        {!selection && searching && <p className="bc-loading">Looking through TMDB…</p>}
        {!selection && query.trim().length >= 2 && !searching && !results.length && !searchError && <p className="bc-empty">No matches found. Try another title or spelling.</p>}
        {searchError && <p className="bc-error">{searchError}</p>}

        <div className="bc-grid">
          <div><label className="bc-field-label" htmlFor="bc-start">START DATE</label><input id="bc-start" className="bc-date" type="date" min={today} value={startDate} onChange={event => setStartDate(event.target.value)}/></div>
          <div><label className="bc-field-label" htmlFor="bc-deadline">FINISH BY</label><input id="bc-deadline" className="bc-date" type="date" min={startDate} value={deadline} onChange={event => setDeadline(event.target.value)}/><div className="bc-quick">{[7,14,30].map(days => <button key={days} type="button" onClick={() => setDeadline(addDays(startDate, days))}>{days} days</button>)}</div></div>
        </div>
        <label className="bc-field-label" htmlFor="bc-hours">DAILY WATCH TIME</label><div className="bc-range-row"><span className="bc-muted">How much time can you set aside each day?</span><strong>{dailyHours}h / day</strong></div><input id="bc-hours" className="bc-range" type="range" min="1" max="12" step="0.5" value={dailyHours} onChange={event => setDailyHours(Number(event.target.value))}/><div className="bc-range-row"><span className="bc-muted">1 hour</span><span className="bc-muted">12 hours</span></div>
        <label className="bc-field-label">DAYS YOU CAN'T WATCH <span className="bc-muted">(OPTIONAL)</span></label><div className="bc-weekdays">{WEEKDAYS.map(day => <label key={day.value}><input type="checkbox" checked={excludedDays.includes(day.value)} onChange={() => setExcludedDays(current => current.includes(day.value) ? current.filter(value => value !== day.value) : [...current, day.value])}/>{day.label}</label>)}</div>
        <div className="bc-options"><label className="bc-check"><input type="checkbox" checked={skipSpecials} onChange={event => setSkipSpecials(event.target.checked)}/> Skip specials or extras</label><label className="bc-check"><input type="checkbox" checked={skipUnaired} onChange={event => setSkipUnaired(event.target.checked)}/> Skip unaired or unreleased titles</label></div>
        {planError && <p className="bc-error">{planError}</p>}
        {loadingPlan && <p className="bc-loading">Gathering runtimes from TMDB and building your watch plan…</p>}
        <div style={{marginTop:20}}><button className="bc-primary" type="button" disabled={!selection || loadingPlan || deadline < startDate || excludedDays.length === 7} onClick={() => selection && void loadPlan(selection)}><Sparkles size={16}/> {loadingPlan ? 'Building your plan…' : 'Calculate my BingeClock'}</button></div>
      </section>

      {plan && schedule && !loadingPlan && <section className="bc-results">
        <div className="bc-result-top"><div><span className="bc-kicker">YOUR WATCH PLAN IS READY</span><h2>{headline} <span style={{color:'#dfff00'}}>({formatTime(Math.ceil(totalMinutes / Math.max(1, availableDays)))}/day)</span></h2><p>{achievable ? `Your plan fits before ${prettyDate(deadline, {month:'short',day:'numeric'})}.` : 'Your current daily limit is not enough to finish by this deadline.'}</p></div><span className={`bc-badge ${!achievable ? 'not' : ''}`}>{feasibility}</span></div>
        <div className="bc-stat-grid"><div className="bc-stat"><span>Total runtime</span><strong>{formatTime(totalMinutes)}</strong><small>{(totalMinutes/60).toFixed(1)} total hours</small></div><div className="bc-stat"><span>{mode === 'series' ? 'Episodes' : 'Movies'}</span><strong>{plan.items.length}</strong><small>{mode === 'series' ? `${plan.stats.seasons} seasons · avg ${formatTime(plan.stats.averageMinutes)}/ep` : `Avg ${formatTime(plan.stats.averageMinutes)} / movie`}</small></div><div className="bc-stat"><span>Daily pace</span><strong>{paceCount}</strong><small>{mode === 'series' ? 'episodes / day' : 'movies / day'}</small></div><div className="bc-stat"><span>Finish date</span><strong>{finishDay ? prettyDate(finishDay) : '—'}</strong><small>{achievable ? 'Within deadline' : `At ${dailyHours}h/day`}</small></div><div className="bc-stat"><span>Buffer days</span><strong>{achievable ? bufferDays : '—'}</strong><small>{achievable ? 'Ahead of deadline' : 'More time needed'}</small></div></div>
        <div className="bc-ring-row"><div className="bc-ring"><svg viewBox="0 0 100 100" width="106" height="106"><circle className="track" cx="50" cy="50" r="42"/><circle className="value" cx="50" cy="50" r="42" strokeDasharray={263.9} strokeDashoffset={263.9 * (1 - Math.min(1, completedCount / Math.max(1, plan.items.length)))}/></svg><div className="bc-ring-center"><strong>{Math.round(completedCount / Math.max(1, plan.items.length) * 100)}%</strong><small>COMPLETE</small></div></div><div className="bc-ring-copy"><strong>{formatTime(totalMinutes - plan.items.filter(item => done.includes(item.key)).reduce((sum,item)=>sum+item.runtime,0))} left · {availableDays} watch days</strong><p>{achievable ? `At your selected pace, you finish ${bufferDays} ${bufferDays === 1 ? 'day' : 'days'} before the deadline.` : `You need about ${Math.max(0, requiredHours - dailyHours).toFixed(1)} extra hours per available day. At your current limit, the earliest finish is ${finishDay ? `${prettyDate(finishDay, {month:'short',day:'numeric',year:'numeric'})}${finishDay > deadline ? ` (${Math.round((parseDate(finishDay).getTime() - parseDate(deadline).getTime()) / 86400000)} days after your deadline)` : ''}` : 'not available'}.`}</p></div></div>
        {plan.missingRuntimeCount > 0 && <p className="bc-note">{plan.missingRuntimeCount} movie(s) without a TMDB runtime were omitted from the calculation.</p>}
        <div className="bc-actions"><button className="bc-secondary" type="button" onClick={() => void sharePlan()}><Share2 size={15}/> Share my plan</button><button className="bc-secondary" type="button" onClick={addCalendar}><CalendarDays size={15}/> Add to calendar</button>{shareNotice && <span className="bc-toast">{shareNotice}</span>}</div>
        <div className="bc-schedule-head"><h3>Your day-by-day schedule</h3><span>{completedCount} / {plan.items.length} completed</span></div><div className="bc-progress"><span style={{width:`${progressPercent}%`}}/></div>
        {schedule.days.map(day => <article className="bc-day" key={day.date}><div className="bc-day-head"><span>{prettyDate(day.date, {weekday:'short',month:'short',day:'numeric'})}</span><small>{day.items.length} {mode === 'series' ? 'episodes' : 'movies'} · {formatTime(day.minutes)}</small></div>{day.items.map(item => { const isDone = done.includes(item.key); return <label className={`bc-watch-item ${isDone ? 'bc-done' : ''}`} key={item.key}><input type="checkbox" checked={isDone} onChange={() => toggleDone(item.key)} aria-label={`Mark ${item.title} as ${isDone ? 'not watched' : 'watched'}`}/>{item.poster && <img src={item.poster} alt="" loading="lazy"/>}<span className="bc-watch-copy"><strong>{item.title}</strong><small>{item.label}</small></span><span className="bc-watch-runtime">{formatTime(item.runtime)}</span></label>; })}</article>)}
        <p className="bc-note">{schedule.days.some(day => day.minutes > dailyHours * 60) ? 'Some individual titles are longer than your daily limit. They remain whole in the schedule and will require extra time on those days.' : 'Each movie or episode stays together in one day. If the next title does not fit, it rolls over to the next available watch day.'} Progress is saved locally in this browser.</p>
      </section>}
      <footer className="bc-attribution"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue.svg" alt="TMDB"/><span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span></footer>
    </div>
  </main>;
}
