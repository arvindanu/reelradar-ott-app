"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Clock3, Film, ListFilter, Search, Sparkles, X } from 'lucide-react';
import TimelinerHeader from './TimelinerHeader';

type Franchise = { id: number; name: string; poster: string | null; backdrop: string | null; hasChronology: boolean };

export default function TimelinerPage() {
  const [franchises,setFranchises] = useState<Franchise[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('az');
  const [page,setPage] = useState(1);
  const [totalPages,setTotalPages] = useState(0);
  const [totalResults,setTotalResults] = useState(0);
  const [introOpen,setIntroOpen] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem('reelradar-timeliner-intro-seen') === '1') setIntroOpen(false); } catch {}
  }, []);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setFranchises([]);
      setTotalPages(0);
      setTotalResults(0);
      setLoading(false);
      setError('');
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/timeliner?action=search&query=${encodeURIComponent(search)}&page=${page}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not search TMDB collections.');
        if (active) {
          const results = Array.isArray(data.results) ? data.results : [];
          setFranchises(results.map((item: any) => ({
            id: Number(item.id),
            name: item.name ?? 'Untitled Collection',
            poster: item.poster ?? null,
            backdrop: item.backdrop ?? null,
            hasChronology: Boolean(item.hasChronology),
          })));
          setTotalPages(Number(data.totalPages) || 0);
          setTotalResults(Number(data.totalResults) || 0);
        }
      } catch (err) {
        if (active && !(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setFranchises([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, page]);

  useEffect(() => { setPage(1); }, [query]);

  const closeIntro = () => { setIntroOpen(false); try { localStorage.setItem('reelradar-timeliner-intro-seen','1'); } catch {} };
  const filtered = useMemo(() => {
    const rows = [...franchises];
    if (sort === 'az') rows.sort((a,b) => a.name.localeCompare(b.name));
    return rows;
  },[franchises,sort]);

  return <main className="tl-page">
    <style jsx global>{`
      .tl-page{min-height:100vh;background:#08090d;color:#f6f7fb;padding:0 0 56px;font-family:inherit}.tl-topbar{height:66px;padding:0 clamp(16px,4vw,56px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(8,9,13,.88);position:sticky;top:0;z-index:20;backdrop-filter:blur(18px)}.tl-wordmark b{color:#dfff00}.tl-back{color:#fff!important}.tl-wrap{width:min(1240px,calc(100% - 40px));margin:0 auto}.tl-hero{padding:48px 0 28px}.tl-kicker{color:#dfff00;font-size:10px;font-weight:800;letter-spacing:2px}.tl-hero h1{font-size:clamp(34px,5vw,58px);letter-spacing:-2px;margin:9px 0 8px}.tl-hero>p{color:#aab0bd;margin:0;max-width:700px;line-height:1.7;font-size:14px}.tl-intro{margin-top:22px;padding:22px;border:1px solid rgba(223,255,0,.18);border-radius:18px;background:linear-gradient(120deg,rgba(223,255,0,.07),rgba(255,255,255,.025));position:relative}.tl-intro-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.tl-intro h2{font-size:17px;margin:0}.tl-intro p{color:#aeb3bf;font-size:13px;line-height:1.65;margin:10px 0 0;max-width:850px}.tl-close{background:transparent;border:1px solid rgba(255,255,255,.16);color:#cdd1d9;border-radius:8px;padding:7px;cursor:pointer}.tl-steps{display:flex;gap:26px;flex-wrap:wrap;margin-top:17px}.tl-step{display:flex;align-items:center;gap:9px;color:#e8eaf0;font-size:12px;font-weight:700}.tl-step svg{color:#dfff00}.tl-intro-reopen{margin:18px 0 0;background:transparent;border:0;color:#dfff00;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;cursor:pointer}.tl-controls{display:grid;grid-template-columns:minmax(220px,1fr) 180px;gap:12px;margin:30px 0 22px}.tl-search,.tl-select{height:46px;border:1px solid rgba(255,255,255,.12);background:#11141c;border-radius:11px;color:#f6f7fb;display:flex;align-items:center;gap:10px;padding:0 13px}.tl-search svg{color:#8d95a5;flex-shrink:0}.tl-search input{background:transparent;border:0;outline:0;color:#fff;width:100%;font:inherit;font-size:13px}.tl-select{width:100%;font-size:12px}.tl-select select{background:transparent;border:0;outline:0;color:#fff;width:100%;font:inherit;appearance:none}.tl-select option{background:#11141c}.tl-results-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 14px;color:#aeb3bf;font-size:11px}.tl-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}.tl-card{min-width:0;text-decoration:none;color:#fff;border-radius:13px;overflow:hidden;background:#11141c;border:1px solid rgba(255,255,255,.07);transition:transform .2s,border-color .2s,box-shadow .2s}.tl-card:hover{transform:translateY(-4px);border-color:rgba(223,255,0,.45);box-shadow:0 12px 35px rgba(0,0,0,.3)}.tl-poster{aspect-ratio:2/3;background:#1b202b;position:relative;overflow:hidden}.tl-poster img{width:100%;height:100%;object-fit:cover;display:block}.tl-count{position:absolute;right:9px;bottom:9px;background:rgba(8,9,13,.88);border:1px solid rgba(223,255,0,.35);color:#dfff00;padding:6px 8px;border-radius:7px;font-size:10px;font-weight:800;backdrop-filter:blur(10px)}.tl-card-copy{padding:12px 12px 14px}.tl-card h3{font-size:13px;margin:0 0 5px;line-height:1.35}.tl-card-copy span{font-size:10px;color:#9da5b4}.tl-arrow{float:right;color:#dfff00}.tl-state{padding:55px 20px;text-align:center;border:1px dashed rgba(255,255,255,.15);border-radius:16px;color:#aeb3bf;font-size:13px}.tl-state strong{display:block;color:#fff;font-size:17px;margin-bottom:8px}.tl-pagination{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:24px;color:#aeb3bf;font-size:12px}.tl-pagination button{border:1px solid rgba(255,255,255,.14);background:#11141c;color:#f6f7fb;border-radius:8px;padding:9px 14px;cursor:pointer}.tl-pagination button:disabled{opacity:.35;cursor:not-allowed}.tl-attribution{margin-top:42px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;color:#8f97a6;font-size:10px;text-align:center}.tl-attribution img{width:78px;height:auto}
      @media(max-width:900px){.tl-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.tl-controls{grid-template-columns:1fr 1fr}.tl-search{grid-column:1/-1}}
      @media(max-width:620px){.tl-topbar{height:58px}.tl-wrap{width:calc(100% - 28px)}.tl-hero{padding:32px 0 15px}.tl-hero h1{font-size:38px}.tl-hero>p{font-size:12px}.tl-intro{padding:16px}.tl-intro p{font-size:12px}.tl-steps{gap:13px;flex-direction:column}.tl-controls{grid-template-columns:1fr 1fr;gap:9px;margin:22px 0 18px}.tl-search{grid-column:1/-1}.tl-select{height:43px;padding:0 9px}.tl-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tl-card-copy{padding:10px}.tl-card h3{font-size:12px}.tl-results-head{font-size:10px}}
      @media(prefers-reduced-motion:reduce){.tl-card{transition:none}.tl-card:hover{transform:none}}
    `}</style>
    <TimelinerHeader/>
    <div className="tl-wrap">
      <section className="tl-hero"><span className="tl-kicker">THE RIGHT ORDER. THE FULL STORY.</span><h1>TIMELINER</h1><p>Find the best order to watch the stories you love. Browse movie franchises, explore their full collections, and switch between release order and in-universe chronology.</p>
        {introOpen ? <div className="tl-intro"><div className="tl-intro-head"><h2>Your franchise watch guide</h2><button className="tl-close" onClick={closeIntro} aria-label="Dismiss introduction"><X size={16}/></button></div><p>Timeliner helps you watch any movie franchise in the right order. Pick a franchise, then switch between the order the movies were released and the order the story happens in. Perfect for newcomers and rewatchers.</p><div className="tl-steps"><span className="tl-step"><Film size={18}/> 1. Pick a franchise</span><span className="tl-step"><ListFilter size={18}/> 2. Choose your order</span><span className="tl-step"><Sparkles size={18}/> 3. Start watching</span></div></div> : <button className="tl-intro-reopen" onClick={()=>setIntroOpen(true)}><Clock3 size={15}/> How Timeliner works <ChevronDown size={14}/></button>}
      </section>
      <div className="tl-controls"><label className="tl-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search any movie franchise or collection..." aria-label="Search TMDB collections"/></label><label className="tl-select"><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort collections"><option value="az">Sort: A–Z</option></select><ChevronDown size={14}/></label></div>
      <div className="tl-results-head"><span>{loading?'SEARCHING TMDB…':query.trim().length < 2?'SEARCH TMDB COLLECTIONS':`${totalResults.toLocaleString()} COLLECTION${totalResults===1?'':'S'} FOUND`}</span><span>{query.trim().length >= 2 ? `PAGE ${page}${totalPages ? ` / ${totalPages}` : ''}` : 'POWERED BY TMDB'}</span></div>
      {loading ? <div className="tl-state"><strong>Searching movie collections…</strong>Finding matching collections from TMDB.</div> : error ? <div className="tl-state"><strong>We couldn't search TMDB</strong>{error}<br/><button className="tl-intro-reopen" onClick={()=>window.location.reload()}>Try again</button></div> : query.trim().length < 2 ? <div className="tl-state"><strong>Discover any movie collection</strong>Search by franchise or collection name. Try Star Wars, Marvel, Harry Potter, Batman, or Fast &amp; Furious.</div> : filtered.length ? <><div className="tl-grid">{filtered.map(item=><Link className="tl-card" href={`/timeliner/${item.id}`} key={item.id}><div className="tl-poster">{item.poster ? <img src={item.poster} alt={`${item.name} poster`} loading="lazy"/> : <div className="tl-state">Poster unavailable</div>}</div><div className="tl-card-copy"><h3>{item.name}<ArrowUpRight className="tl-arrow" size={14}/></h3><span>{item.hasChronology?'Release + story order configured':'Release order · Story order not configured'}</span></div></Link>)}</div><div className="tl-pagination"><button type="button" disabled={page<=1 || loading} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {page} of {Math.max(totalPages,1)}</span><button type="button" disabled={page>=totalPages || loading} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>Next</button></div></> : <div className="tl-state"><strong>No collections found</strong>Try another franchise or collection name.</div>}
      <footer className="tl-attribution"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue.svg" alt="TMDB"/><span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span></footer>
    </div>
  </main>;
}
