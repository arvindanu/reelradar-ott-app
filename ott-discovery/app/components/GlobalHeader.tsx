
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Clapperboard,
  Globe2,
  ChevronDown,
  Menu,
  X,
  Compass,
  Heart,
  GitMerge,
  Dices,
  Clock3,
  Sparkles,
  Hourglass,
  ScanEye,
  ScanSearch,
  CalendarClock,
} from 'lucide-react';
import { COUNTRIES } from '@/lib/catalog';

const REGION_STORAGE_KEY = 'reelradar-region-v1';

export default function GlobalHeader() {
  const pathname = usePathname();

  const [region, setRegion] = useState('IN');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuDrawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const savedRegion = window.localStorage.getItem(REGION_STORAGE_KEY);
      if (savedRegion && COUNTRIES.some(country => country.code === savedRegion)) {
        setRegion(savedRegion);
      }
    } catch {
      // Keep the default region if storage is unavailable.
    }

    setShowWishlist(
      pathname === '/' &&
      new URLSearchParams(window.location.search).get('view') === 'wishlist'
    );
  }, [pathname]);

  const menuItems = [
    {
      key: 'all',
      label: 'Discover',
      action: () => window.location.assign('/'),
    },
    {
      key: 'wishlist',
      label: 'My Watchlist',
      action: () => window.location.assign('/?view=wishlist'),
    },
    {
      key: 'collide',
      label: 'Movie Collide',
      action: () => window.location.assign('/collide'),
    },
    {
      key: 'roulette',
      label: 'Movie Roulette',
      action: () => window.location.assign('/roulette'),
    },
    {
      key: 'timeliner',
      label: 'Timeliner',
      action: () => window.location.assign('/timeliner'),
    },
    {
      key: 'vibeflix',
      label: 'VibeFlix',
      action: () => window.location.assign('/vibeflix'),
    },
    {
      key: 'bingeclock',
      label: 'BingeClock',
      action: () => window.location.assign('/bingeclock'),
    },
    {
      key: 'actorlens',
      label: 'ActorLens',
      action: () => window.location.assign('/actorlens'),
    },
    {
      key: 'dropclock',
      label: 'DropClock',
      action: () => window.location.assign('/dropclock'),
    },
    {
      key: 'lookalike',
      label: 'Lookalike',
      action: () => window.location.assign('/lookalike'),
    },
  ];

  const isActive = (key: string) => {
    if (key === 'all') return pathname === '/' && !showWishlist;
    if (key === 'wishlist') return pathname === '/' && showWishlist;
    if (key === 'actorlens') return pathname.startsWith('/actorlens');
    if (key === 'collide') return pathname === '/collide';
    if (key === 'roulette') return pathname === '/roulette';
    if (key === 'timeliner') return pathname === '/timeliner';
    if (key === 'vibeflix') return pathname === '/vibeflix';
    if (key === 'bingeclock') return pathname === '/bingeclock';
    if (key === 'dropclock') return pathname === '/dropclock';
    if (key === 'lookalike') return pathname === '/lookalike';
    return false;
  };

  const handleRegionChange = (value: string) => {
    setRegion(value);

    try {
      window.localStorage.setItem(REGION_STORAGE_KEY, value);
    } catch {
      // Region remains available in component state.
    }

    window.dispatchEvent(
      new CustomEvent('reelradar-region-change', {
        detail: value,
      })
    );
  };

  const handleMenuAction = (item: typeof menuItems[number]) => {
    setMobileMenu(false);

    if (
      item.key === 'bingeclock' ||
      item.key === 'actorlens' ||
      item.key === 'dropclock'
    ) {
      window.setTimeout(item.action, 180);
    } else {
      item.action();
    }
  };

  useEffect(() => {
    if (!mobileMenu) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = window.requestAnimationFrame(() => {
      menuDrawerRef.current
        ?.querySelector<HTMLButtonElement>('button')
        ?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenu(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !menuDrawerRef.current) return;

      const focusable = Array.from(
        menuDrawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFirst);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      menuTriggerRef.current?.focus();
    };
  }, [mobileMenu]);

  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Clapperboard size={19} strokeWidth={1.7} />
          </span>
          <span>REEL<span>RADAR</span></span>
          <i />
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={isActive(item.key) ? 'nav-active' : ''}
              onClick={item.action}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <label className="region-select">
            <Globe2 size={15} />

            <select
              value={region}
              onChange={event => handleRegionChange(event.target.value)}
              aria-label="Streaming country"
            >
              {COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>

            <ChevronDown size={13} />
          </label>

          <button
            ref={menuTriggerRef}
            className="mobile-menu-button"
            onClick={() => setMobileMenu(open => !open)}
            aria-label={
              mobileMenu
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={mobileMenu}
            aria-controls="mobile-navigation-drawer"
            type="button"
          >
            <Menu />
          </button>
        </div>
      </header>

      <button
        className={`mobile-drawer-overlay ${mobileMenu ? 'is-open' : ''}`}
        type="button"
        aria-label="Close navigation menu"
        tabIndex={mobileMenu ? 0 : -1}
        onClick={() => setMobileMenu(false)}
      />

      <aside
        ref={menuDrawerRef}
        id="mobile-navigation-drawer"
        className={`mobile-navigation-drawer ${mobileMenu ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileMenu}
      >
        <div className="mobile-drawer-header">
          <span>MENU</span>

          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mobile-drawer-links" aria-label="Main navigation">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={isActive(item.key) ? 'nav-active' : ''}
              onClick={() => handleMenuAction(item)}
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
              {item.key === 'dropclock' && <CalendarClock size={17} />}
              {item.key === 'lookalike' && <ScanSearch size={17} />}

              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
