'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Play, Star, ArrowUpRight, Film, Clapperboard, Tv, Globe2, Sparkles, ChevronDown, X, Menu, CalendarDays, Radio, LoaderCircle, ExternalLink } from 'lucide-react';
import { COUNTRIES, LANGUAGES } from '@/lib/catalog';

type Provider = { id: number; name: string; logo: string | null };
type Title = { id: number; mediaType: 'movie'|'tv'; title: string; overview: string; poster: string|null; backdrop: string|null; releaseDate: string; year: string; rating: number|null; language: string; genres: number[]; trailerKey: string|null; trailerThumb: string|null; providers: Provider[]; watchLink: string|null };
type Mode = 'all'|'movie'|'tv'|'documentary';
const LANG_LABEL: Record<string,string> = Object.fromEntries(LANGUAGES.map(x=>[x.code,x.label]));
const GENRES: Record<number,string> = {28:'Action',12:'Adventure',16:'Animation',18:'Drama',27:'Horror',35:'Comedy',36:'History',37:'Western',53:'Thriller',80:'Crime',99:'Documentary',878:'Sci-Fi',9648:'Mystery',10749:'Romance',10751:'Family',10752:'War',10759:'Action & Adventure',10765:'Sci-Fi & Fantasy',10768:'War & Politics'};

function Poster({ item, onOpen }: { item: Title; onOpen: (x:Title)=>void }) {
  const trailerUrl = item.trailerKey ? `https://www.youtube.com/watch?v=${item.trailerKey}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title+' official trailer')}`;
  return <article className="poster-card" onClick={()=>onOpen(item)} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&onOpen(item)}>
    <div className="poster-art">
      {item.poster ? <img src={item.poster} alt={`${item.title} poster`} loading="lazy"/> : <div className="poster-fallback"><Film size={30}/><span>{item.title}</span></div>}
      <div className="poster-shade"/>
      <div className="poster-topline"><span className="type-pill">{item.mediaType==='tv'?'SERIES':'FILM'}</span>{item.rating!==null&&<span className="rating"><Star size={11} fill="currentColor"/> {item.rating.toFixed(1)}</span>}</div>
      <button className="quick-play" aria-label={`View ${item.title}`}><Play size={16} fill="currentColor"/></button>
      <div className="poster-info"><h3>{item.title}</h3><p>{item.year || 'New release'} <span>·</span> {LANG_LABEL[item.language] ?? item.language.toUpperCase()}</p></div>
    </div>
    <a className="card-trailer" href={trailerUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><span className="trailer-thumb">{item.trailerThumb?<img src={item.trailerThumb} alt="" loading="lazy"/>:<Play size={12}/>}<Play size={9} fill="currentColor"/></span><span>WATCH TRAILER</span><ArrowUpRight size={12}/></a>
    <div className="card-meta"><div className="provider-stack">{item.providers.length ? item.providers.slice(0,3).map(p=>p.logo?<img key={p.id} src={p.logo} alt={p.name} title={p.name}/>:<span key={p.id} title={p.name}>{p.name.slice(0,1)}</span>) : <span className="provider-empty">No OTT data</span>}</div><span className="card-arrow"><ArrowUpRight size={15}/></span></div>
  </article>;
}

function DetailModal({ item, close }: { item:Title; close:()=>void }) {
  const trailer = item.trailerKey ? `https://www.youtube.com/watch?v=${item.trailerKey}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title+' official trailer')}`;
  return <div className="modal-backdrop" onMouseDown={close}><section className="detail-modal" onMouseDown={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={close} aria-label="Close"><X size={18}/></button>
    <div className="modal-hero" style={item.backdrop?{backgroundImage:`linear-gradient(90deg,rgba(8,9,13,.98),rgba(8,9,13,.58)),url(${item.backdrop})`}:{}}>
      <div className="modal-copy"><span className="eyebrow">{item.mediaType==='tv'?'SERIES':'MOVIE'} · {item.year}</span><h2>{item.title}</h2><div className="modal-stats">{item.rating!==null&&<span><Star size={14} fill="currentColor"/> {item.rating.toFixed(1)} / 10</span>}<span>{LANG_LABEL[item.language]??item.language.toUpperCase()}</span></div><p>{item.overview||'Synopsis not available yet.'}</p><a className="primary-cta" href={trailer} target="_blank" rel="noreferrer"><Play size={15} fill="currentColor"/> Watch trailer on YouTube <ExternalLink size={14}/></a></div>
    </div>
    <div className="modal-bottom"><div><span className="eyebrow">WHERE TO WATCH</span><h3>Available on your platforms</h3></div>{item.watchLink&&<a className="provider-link" href={item.watchLink} target="_blank" rel="noreferrer">All options <ArrowUpRight size={14}/></a>}</div>
    {item.providers.length ? <div className="modal-providers">{item.providers.map(p=><div className="modal-provider" key={p.id}>{p.logo&&<img src={p.logo} alt=""/>}<span>{p.name}</span></div>)}</div>:<p className="no-provider">No streaming availability was returned for this country. Try changing your region.</p>}
    {item.trailerThumb&&<a className="trailer-preview" href={trailer} target="_blank" rel="noreferrer"><img src={item.trailerThumb} alt="Trailer thumbnail"/><span className="trailer-play"><Play fill="currentColor"/></span><span>PLAY OFFICIAL TRAILER</span></a>}
  </section></div>;
}

export default function Home() {
  const [mode,setMode]=useState<Mode>('all'); const [language,setLanguage]=useState(''); const [region,setRegion]=useState('IN');
  const [query,setQuery]=useState(''); const [search,setSearch]=useState(''); const [items,setItems]=useState<Title[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [selected,setSelected]=useState<Title|null>(null); const [mobileMenu,setMobileMenu]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError('');try{const p=new URLSearchParams({type:mode,language,region,query:search});const res=await fetch(`/api/discover?${p.toString()}`);const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not load titles');setItems(data.results||[]);}catch(e){setError(e instanceof Error?e.message:'Something went wrong');setItems([]);}finally{setLoading(false);}},[mode,language,region,search]);
  useEffect(()=>{load();},[load]);
  const featured=useMemo(()=>items.find(x=>x.backdrop)||items[0],[items]);
  const submitSearch=(e:React.FormEvent)=>{e.preventDefault();setSearch(query.trim());};
  const tabs:[Mode,string][]=[['all','Discover'],['movie','Movies'],['tv','Series'],['documentary','Documentaries']];
  return <main className="site-shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Radio size={19}/></span><span>REEL<span>RADAR</span></span><i/></a><nav className="desktop-nav">{tabs.map(([v,l])=><button key={v} className={mode===v?'nav-active':''} onClick={()=>{setMode(v);setSearch('');setQuery('');}}>{l}</button>)}</nav><div className="header-actions"><label className="region-select"><Globe2 size={15}/><select value={region} onChange={e=>setRegion(e.target.value)} aria-label="Streaming country">{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select><ChevronDown size={13}/></label><button className="mobile-menu-button" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Toggle menu"><Menu/></button></div></header>
    {mobileMenu&&<nav className="mobile-nav">{tabs.map(([v,l])=><button key={v} className={mode===v?'nav-active':''} onClick={()=>{setMode(v);setMobileMenu(false);}}>{l}</button>)}</nav>}
    <section className="intro" id="top"><div className="intro-orb orb-one"/><div className="intro-orb orb-two"/><div className="intro-content"><div className="eyebrow intro-kicker"><Sparkles size={13}/> YOUR NEXT OBSESSION STARTS HERE</div><h1>Less scrolling.<br/><span>More watching.</span></h1><p>Every story worth watching, across every language and platform.</p><form className="searchbar" onSubmit={submitSearch}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search movies, series, documentaries…"/><button type="submit">Explore <ArrowUpRight size={15}/></button></form><div className="intro-foot"><span><span className="live-dot"/> FRESH RELEASES</span><span>10 LANGUAGES</span><span>ONE DISCOVERY SPACE</span></div></div><div className="intro-art"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-glass"><Clapperboard size={44}/><span>THE WORLD<br/>OF STORIES</span><small>CURATED FOR YOU</small></div><div className="floating-chip chip-a">✦ &nbsp; New this week</div><div className="floating-chip chip-b">10 languages</div></div></section>
    <section className="catalog-section"><div className="section-heading"><div><div className="eyebrow">THE DISCOVERY FEED</div><h2>{search?`Results for “${search}”`:mode==='all'?'The latest drop':mode==='movie'?'Fresh films':mode==='tv'?'New episodes & series':'Documentary spotlight'}</h2><p>Fresh picks, sorted by release date. Availability depends on your region.</p></div><div className="result-count"><SlidersHorizontal size={15}/><span>{items.length} TITLES</span></div></div>
      <div className="filter-row"><div className="language-filters"><button className={!language?'filter-chip selected':''} onClick={()=>setLanguage('')}>All languages</button>{LANGUAGES.map(l=><button key={l.code} className={language===l.code?'filter-chip selected':''} onClick={()=>setLanguage(language===l.code?'':l.code)}>{l.label}</button>)}</div><div className="region-note"><Globe2 size={13}/> {COUNTRIES.find(c=>c.code===region)?.label}</div></div>
      {loading?<div className="loading-grid">{Array.from({length:10}).map((_,i)=><div className="skeleton" key={i}/>)}</div>:error?<div className="empty-state"><div className="empty-icon"><Radio size={25}/></div><h3>Connect your discovery engine</h3><p>{error}</p><span>Add your TMDB API token to <code>.env.local</code>, then restart the app.</span><button className="retry-button" onClick={load}>Try again</button></div>:items.length===0?<div className="empty-state"><div className="empty-icon"><Search size={25}/></div><h3>No titles found</h3><p>Try another language, category or search term.</p><button className="retry-button" onClick={()=>{setLanguage('');setSearch('');setQuery('');setMode('all');}}>Clear filters</button></div>:<><div className="poster-grid">{items.map(item=><Poster key={`${item.mediaType}-${item.id}`} item={item} onOpen={setSelected}/>)}</div><div className="feed-footer"><span>YOU'RE ALL CAUGHT UP</span><span>UPDATED LIVE FROM TMDB <span className="live-dot"/></span></div></>}
    </section>
    <footer className="footer"><a className="brand" href="#top"><span className="brand-mark"><Radio size={17}/></span><span>REEL<span>RADAR</span></span></a><p>One place for everything worth watching.</p><span className="footer-credit">MOVIE DATA & IMAGES BY TMDB · NOT AN OFFICIAL TMDB PRODUCT</span></footer>
    {selected&&<DetailModal item={selected} close={()=>setSelected(null)}/>}
  </main>;
}
