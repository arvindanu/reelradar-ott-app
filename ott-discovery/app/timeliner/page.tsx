
"use client";
import './timeliner/timeliner.css';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronDown,
  Clapperboard,
  Clock3,
  Film,
  ListFilter,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import TimelinerHeader from './TimelinerHeader';

type Franchise = {
  id: string;
  name: string;
  poster: string | null;
  backdrop: string | null;
  hasChronology: boolean;
  kind: 'franchise' | 'collection';
};

export default function TimelinerPage() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [introOpen, setIntroOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem('reelradar-timeliner-intro-seen') === '1') {
        setIntroOpen(false);
      }
    } catch {}
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
        const response = await fetch(
          `/api/timeliner?action=search&query=${encodeURIComponent(search)}&page=${page}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Could not search TMDB collections.');
        }

        if (active) {
          const collectionResults = Array.isArray(data.results)
            ? data.results
            : [];

          const curatedResults = Array.isArray(data.franchises)
            ? data.franchises
            : [];

          const combinedResults = [
            ...curatedResults,
            ...collectionResults,
          ];

          setFranchises(combinedResults.map((item: any) => ({
            id: String(item.id),
            name: item.name ?? 'Untitled Collection',
            poster: item.poster ?? null,
            backdrop: item.backdrop ?? null,
            hasChronology: Boolean(item.hasChronology),
            kind: item.kind === 'franchise' ? 'franchise' : 'collection',
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

  useEffect(() => {
    setPage(1);
  }, [query]);

  const closeIntro = () => {
    setIntroOpen(false);

    try {
      localStorage.setItem('reelradar-timeliner-intro-seen', '1');
    } catch {}
  };

  const filtered = useMemo(() => {
    const rows = [...franchises];

    if (sort === 'az') {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }

    return rows;
  }, [franchises, sort]);

  return (
    <main className="tl-page">
      <TimelinerHeader />

      <div className="tl-wrap">
        <section className="tl-hero">
          <span className="tl-kicker">THE RIGHT ORDER. THE FULL STORY.</span>
          <h1>TIMELINER</h1>
          <p>
            Find the best order to watch the stories you love. Browse movie franchises,
            explore their full collections, and switch between release order and
            in-universe chronology.
          </p>

          {introOpen ? (
            <div className="tl-intro">
              <div className="tl-intro-head">
                <h2>Your franchise watch guide</h2>
                <button
                  className="tl-close"
                  onClick={closeIntro}
                  aria-label="Dismiss introduction"
                >
                  <X size={16} />
                </button>
              </div>

              <p>
                Timeliner helps you watch any movie franchise in the right order.
                Pick a franchise, then switch between the order the movies were
                released and the order the story happens in. Perfect for newcomers
                and rewatchers.
              </p>

              <div className="tl-steps">
                <span className="tl-step">
                  <Film size={18} /> 1. Pick a franchise
                </span>
                <span className="tl-step">
                  <ListFilter size={18} /> 2. Choose your order
                </span>
                <span className="tl-step">
                  <Sparkles size={18} /> 3. Start watching
                </span>
              </div>
            </div>
          ) : (
            <button
              className="tl-intro-reopen"
              onClick={() => setIntroOpen(true)}
            >
              <Clock3 size={15} /> How Timeliner works <ChevronDown size={14} />
            </button>
          )}
        </section>

        <div className="tl-controls">
          <label className="tl-search">
            <Search size={17} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search any movie franchise or collection..."
              aria-label="Search movie franchises and collections"
            />
          </label>

          <label className="tl-select">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              aria-label="Sort collections"
            >
              <option value="az">Sort: A–Z</option>
            </select>
            <ChevronDown size={14} />
          </label>
        </div>

        <div className="tl-results-head">
          <span>
            {loading
              ? 'SEARCHING FRANCHISES…'
              : query.trim().length < 2
                ? 'SEARCH FRANCHISES & COLLECTIONS'
                : `${totalResults.toLocaleString()} RESULTS FOUND`}
          </span>
          <span>
            {query.trim().length >= 2
              ? `PAGE ${page}${totalPages ? ` / ${totalPages}` : ''}`
              : 'POWERED BY TMDB'}
          </span>
        </div>

        {loading ? (
          <div className="tl-state">
            <strong>Searching movie franchises…</strong>
            Finding matching franchises and collections.
          </div>
        ) : error ? (
          <div className="tl-state">
            <strong>We couldn't search for franchises</strong>
            {error}
            <br />
            <button
              className="tl-intro-reopen"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        ) : query.trim().length < 2 ? (
          <div className="tl-state">
            <strong>Discover any movie franchise</strong>
            Search by franchise or collection name. Try Star Wars, Marvel,
            Harry Potter, Batman, or Fast &amp; Furious.
          </div>
        ) : filtered.length ? (
          <>
            <div className="tl-grid">
              {filtered.map(item => (
                <Link
                  className="tl-card"
                  href={`/timeliner/${encodeURIComponent(item.id)}?kind=${item.kind}`}
                  key={`${item.kind}-${item.id}`}
                >
                  <div className="tl-poster">
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt={`${item.name} poster`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="tl-state">Poster unavailable</div>
                    )}
                  </div>

                  <div className="tl-card-copy">
                    <h3>
                      {item.name}
                      <ArrowUpRight className="tl-arrow" size={14} />
                    </h3>
                    <span>
                      {item.hasChronology
                        ? 'Release + story order configured'
                        : 'Release order · Story order not configured'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="tl-pagination">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(value => Math.max(1, value - 1))}
              >
                Previous
              </button>

              <span>Page {page} of {Math.max(totalPages, 1)}</span>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(value => Math.min(totalPages, value + 1))}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="tl-state">
            <strong>No franchises or collections found</strong>
            Try another franchise or collection name.
          </div>
        )}

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
    </main>
  );
}
