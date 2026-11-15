'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarClock, Clapperboard, Clock3, Dices, GitMerge, Globe2,
  ChevronDown, Home as HomeIcon, Hourglass, Menu, ScanEye, ScanSearch, Sparkles, X, Film,
} from 'lucide-react';
import { COUNTRIES } from '@/lib/catalog';

const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/', Icon: HomeIcon },
  { key: 'noir', label: 'NOIR', href: '/noir', Icon: Film },
  { key: 'collide', label: 'Movie Collide', href: '/collide', Icon: GitMerge },
  { key: 'roulette', label: 'Movie Roulette', href: '/roulette', Icon: Dices },
  { key: 'timeliner', label: 'Timeliner', href: '/timeliner', Icon: Clock3 },
  { key: 'vibeflix', label: 'VibeFlix', href: '/vibeflix', Icon: Sparkles },
  { key: 'bingeclock', label: 'BingeClock', href: '/bingeclock', Icon: Hourglass },
  { key: 'actorlens', label: 'ActorLens', href: '/actorlens', Icon: ScanEye },
  { key: 'dropclock', label: 'DropClock', href: '/dropclock', Icon: CalendarClock },
  { key: 'lookalike', label: 'Lookalike', href: '/lookalike', Icon: ScanSearch },
];

export default function SharedSiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isNoir = pathname === '/noir';
  const [menuOpen, setMenuOpen] = useState(false);
  const [region, setRegion] = useState('IN');
  const [countries, setCountries] = useState<Array<{ code: string; label: string }>>(COUNTRIES.map(country => ({ code: country.code, label: country.label })));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const brandMarkRef = useRef<HTMLSpanElement>(null);
  const splashFlightRef = useRef<HTMLDivElement>(null);
  const [showCinematicSplash, setShowCinematicSplash] = useState(true);
  const [splashFlying, setSplashFlying] = useState(false);

  // Play the studio-style intro once per browser tab session, across every route.
  useEffect(() => {
    const splashKey = 'reelradar-splash-shown';

    if (document.documentElement.dataset.rrSplashSkip === 'true') {
      setShowCinematicSplash(false);
      return;
    }

    try {
      if (window.sessionStorage.getItem(splashKey)) {
        setShowCinematicSplash(false);
        return;
      }
    } catch {
      // If storage is unavailable, still show the intro for this page load.
    }

    let startFrame = 0;
    let travelTimer = 0;
    let finishTimer = 0;
    let flightAnimation: Animation | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Defer session marking by one frame so React Strict Mode's development
    // effect replay cannot consume the first-run intro before it animates.
    startFrame = window.requestAnimationFrame(() => {
      try { window.sessionStorage.setItem(splashKey, 'true'); } catch { /* Storage is optional. */ }

      if (reducedMotion) {
        setSplashFlying(true);
        finishTimer = window.setTimeout(() => setShowCinematicSplash(false), 380);
        return;
      }

      travelTimer = window.setTimeout(() => {
        const flight = splashFlightRef.current;
        const target = brandMarkRef.current;
        setSplashFlying(true);

        if (!flight || !target) {
          finishTimer = window.setTimeout(() => setShowCinematicSplash(false), 900);
          return;
        }

        const targetRect = target.getBoundingClientRect();
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const dx = targetCenterX - window.innerWidth / 2;
        const dy = targetCenterY - window.innerHeight / 2;
        const scale = Math.min(targetRect.width / 76, targetRect.height / 76);

        flightAnimation = flight.animate(
          [
            { transform: 'translate(-50%, -50%) scale(1)' },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})` },
          ],
          { duration: 900, easing: 'cubic-bezier(0.72, 0.02, 0.25, 1)', fill: 'forwards' },
        );
        flightAnimation.onfinish = () => setShowCinematicSplash(false);
      }, 820);
    });

    return () => {
      window.cancelAnimationFrame(startFrame);
      window.clearTimeout(travelTimer);
      window.clearTimeout(finishTimer);
      flightAnimation?.cancel();
    };
  }, []);

  useEffect(() => {
    try { setRegion(localStorage.getItem('reelradar-region') || 'IN'); } catch { /* Storage is optional. */ }
    let active = true;
    fetch('/api/discover?regions=1', { cache: 'force-cache' })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load supported countries');
        const data = await response.json();
        if (active && Array.isArray(data.countries) && data.countries.length) {
          setCountries(data.countries);
        }
      })
      .catch(() => { /* Keep the built-in country list if TMDB is unavailable. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [menuOpen]);

  const isActive = (key: string) => key === 'home'
    ? pathname === '/'
    : key === 'actorlens'
      ? pathname.startsWith('/actorlens')
      : pathname === `/${key}`;

  const navigate = (href: string) => {
    setMenuOpen(false);
    router.push(href);
    if (href === '/') window.dispatchEvent(new Event('reelradar-reset-home'));
    if (href.includes('view=watchlist')) window.dispatchEvent(new Event('reelradar-show-wishlist'));
  };

  return <>
    {showCinematicSplash && <div className={`rr-cinematic-splash${splashFlying ? ' is-flying' : ''}`} role="status" aria-label="Opening REELRADAR">
      <div className="rr-splash-backdrop" />
      <div className="rr-splash-flight" ref={splashFlightRef} aria-hidden="true">
        <span className="rr-splash-logo-mark"><Clapperboard size={45} strokeWidth={1.7} /></span>
      </div>
      <div className="rr-splash-copy" aria-hidden="true">
        <div className="rr-splash-wordmark">REEL<span>RADAR</span></div>
        <p>YOUR NEXT WATCH STARTS HERE</p>
        <span className="rr-splash-rule"><i /></span>
      </div>
    </div>}
    <header className={`topbar rr-shared-topbar${isNoir ? ' rr-noir-chrome' : ''}`}>
      <Link className="brand" href="/" aria-label="REELRADAR Home">
        <span className="brand-mark" ref={brandMarkRef}><Clapperboard size={19} strokeWidth={1.7} /></span>
        <span>REEL<span>RADAR</span></span><i />
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(item => <button key={item.key} className={isActive(item.key) ? 'nav-active' : ''} onClick={() => navigate(item.href)} type="button">{item.label}</button>)}
      </nav>
      <div className="header-actions">
        <label className="region-select"><Globe2 size={15} />
          <select value={region} onChange={event => {
            const nextRegion = event.target.value;
            setRegion(nextRegion);
            try { localStorage.setItem('reelradar-region', nextRegion); } catch { /* Storage is optional. */ }
            window.dispatchEvent(new CustomEvent('reelradar-region-change', { detail: nextRegion }));
          }} aria-label="Streaming country">
            {countries.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}
          </select>
          <ChevronDown size={13} />
        </label>
        <button ref={triggerRef} className="mobile-menu-button" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation-drawer" type="button">
          <Menu size={22} />
        </button>
      </div>
    </header>
    <button className={`mobile-drawer-overlay ${menuOpen ? 'is-open' : ''}${isNoir ? ' rr-noir-chrome' : ''}`} type="button" aria-label="Close navigation menu" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
    <aside ref={drawerRef} id="mobile-navigation-drawer" className={`mobile-navigation-drawer ${menuOpen ? 'is-open' : ''}${isNoir ? ' rr-noir-chrome' : ''}`} role="dialog" aria-modal="true" aria-label="Navigation menu" aria-hidden={!menuOpen}>
      <div className="mobile-drawer-header"><span>MENU</span><button type="button" className="mobile-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
      <nav className="mobile-drawer-links" aria-label="Main navigation">
        {NAV_ITEMS.map(({ key, label, href, Icon }) => <Link key={key} href={href} className={isActive(key) ? 'nav-active' : ''} onClick={() => { setMenuOpen(false); if (key === 'home') window.dispatchEvent(new Event('reelradar-reset-home')); }}><Icon size={17} />{label}</Link>)}
      </nav>
    </aside>
    <div key={pathname} className="rr-page-content rr-route-transition">{children}</div>
    <footer className={`footer rr-shared-footer${isNoir ? ' rr-noir-chrome' : ''}`}>
      <Link className="brand" href="/"><span className="brand-mark"><Clapperboard size={17} strokeWidth={1.7} /></span><span>REEL<span>RADAR</span></span></Link>
      <p>One place for everything worth watching.</p>
      <span className="footer-credit">MOVIE DATA &amp; IMAGES BY TMDB · NOT AN OFFICIAL TMDB PRODUCT</span>
    </footer>
  </>;
}
