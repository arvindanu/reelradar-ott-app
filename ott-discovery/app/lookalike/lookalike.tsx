
'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Sparkles,
  Film,
  Tv,
  Star,
  ArrowUpRight,
  LoaderCircle,
  X,
  Target,
  Clapperboard,
  RotateCcw,
} from 'lucide-react';

type MediaType = 'movie' | 'tv';

type Title = {
  id: number;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  releaseDate: string;
  year: string;
  rating: number | null;
  voteCount: number;
  popularity: number;
  language: string;
  genres: number[];
};

type LookalikeResult = Title & {
  score: number;
  reasons: string[];
  matchType: 'both' | 'recommendation' | 'similar';
};

type SourceTitle = {
  id: number;
  title: string;
  overview?: string;
  poster: string | null;
  backdrop?: string | null;
  year: string;
  mediaType: MediaType;
};

export default function Lookalike() {
  const [type, setType] = useState<MediaType>('movie');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Title[]>([]);
  const [selected, setSelected] = useState<Title | null>(null);
  const [results, setResults] = useState<LookalikeResult[]>([]);
  const [source, setSource] = useState<SourceTitle | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          type,
        });

        const response = await fetch(
          `/api/lookalike?${params.toString()}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Search failed.');
        }

        setSearchResults(
          Array.isArray(data.results) ? data.results : []
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, type, selected]);

  const chooseTitle = (item: Title) => {
    setSelected(item);
    setQuery(item.title);
    setSearchResults([]);
    setResults([]);
    setSource(null);
    setError('');
    setHasSearched(false);
  };

  const findLookalikes = async () => {
    if (!selected || loading) return;

    setLoading(true);
    setError('');
    setResults([]);
    setSource(null);
    setHasSearched(false);

    try {
      const response = await fetch('/api/lookalike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Could not find similar titles.'
        );
      }

      setSource(data.source ?? null);
      setResults(
        Array.isArray(data.results) ? data.results : []
      );
      setHasSearched(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setQuery('');
    setSelected(null);
    setSearchResults([]);
    setResults([]);
    setSource(null);
    setError('');
    setHasSearched(false);
  };

  return (
    <main className="lookalike-page">
      <header className="lookalike-header">
        <a href="/" className="lookalike-brand">
          <span className="lookalike-brand-icon">
            <Clapperboard size={20} />
          </span>
          <span>REEL<span>RADAR</span></span>
        </a>
        <a href="/" className="lookalike-back">
          <ArrowUpRight size={15} />
          Back to Discover
        </a>
      </header>

      <section className="lookalike-hero">
        <div className="lookalike-orb lookalike-orb-one" />
        <div className="lookalike-orb lookalike-orb-two" />

        <div className="lookalike-hero-content">
          <div className="lookalike-eyebrow">
            <Sparkles size={14} />
            SMART TITLE DISCOVERY
          </div>

          <h1>
            Find your next
            <span> lookalike.</span>
          </h1>

          <p className="lookalike-description">
            Loved a movie or series? Discover titles with a
            similar story, themes, genres and overall feel.
          </p>

          <div className="lookalike-search-panel">
            <div className="lookalike-type-switch">
              <button
                type="button"
                className={type === 'movie' ? 'active' : ''}
                onClick={() => {
                  setType('movie');
                  setSelected(null);
                  setQuery('');
                  setSearchResults([]);
                  setResults([]);
                  setSource(null);
                  setHasSearched(false);
                }}
              >
                <Film size={15} />
                Movies
              </button>

              <button
                type="button"
                className={type === 'tv' ? 'active' : ''}
                onClick={() => {
                  setType('tv');
                  setSelected(null);
                  setQuery('');
                  setSearchResults([]);
                  setResults([]);
                  setSource(null);
                  setHasSearched(false);
                }}
              >
                <Tv size={15} />
                Series
              </button>
            </div>

            <div className="lookalike-input-wrap">
              <Search size={20} className="lookalike-search-icon" />

              <input
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setSelected(null);
                  setResults([]);
                  setSource(null);
                  setHasSearched(false);
                  setError('');
                }}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    setSearchResults([]);
                  }
                }}
                placeholder={
                  type === 'movie'
                    ? 'Search for a movie...'
                    : 'Search for a series...'
                }
                autoComplete="off"
                aria-label={`Search for a ${type === 'movie' ? 'movie' : 'series'}`}
              />

              {query && (
                <button
                  type="button"
                  className="lookalike-clear"
                  onClick={reset}
                  aria-label="Clear search"
                >
                  <X size={17} />
                </button>
              )}

              {searching && (
                <LoaderCircle
                  size={18}
                  className="lookalike-search-loader"
                />
              )}
            </div>

            {searchResults.length > 0 && !selected && (
              <div className="lookalike-search-results">
                {searchResults.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    className="lookalike-search-result"
                    onClick={() => chooseTitle(item)}
                  >
                    <span className="lookalike-result-poster">
                      {item.poster ? (
                        <img src={item.poster} alt="" />
                      ) : (
                        <Film size={18} />
                      )}
                    </span>

                    <span className="lookalike-result-info">
                      <strong>{item.title}</strong>
                      <small>
                        {item.year || 'Release date unavailable'}
                        {item.rating !== null
                          ? ` · ★ ${item.rating.toFixed(1)}`
                          : ''}
                      </small>
                    </span>

                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            )}

            {query.trim().length >= 2 &&
              !searching &&
              !selected &&
              searchResults.length === 0 && (
                <div className="lookalike-no-search">
                  No matching titles found. Try another search.
                </div>
              )}

            {selected && (
              <div className="lookalike-selected">
                <div className="lookalike-selected-poster">
                  {selected.poster ? (
                    <img src={selected.poster} alt="" />
                  ) : (
                    <Film size={20} />
                  )}
                </div>

                <div className="lookalike-selected-info">
                  <small>SELECTED TITLE</small>
                  <strong>{selected.title}</strong>
                  <span>
                    {selected.year || 'Year unavailable'}
                    {selected.rating !== null
                      ? ` · ★ ${selected.rating.toFixed(1)}`
                      : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={reset}
                  aria-label="Remove selected title"
                >
                  <X size={17} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="lookalike-submit"
              disabled={!selected || loading}
              onClick={findLookalikes}
            >
              {loading ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Finding your matches...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  Find Lookalikes
                  <ArrowUpRight size={16} />
                </>
              )}
            </button>

            <div className="lookalike-search-foot">
              <span>
                <Target size={13} />
                TMDB-powered matching
              </span>
              <span>Movies &amp; series</span>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="lookalike-message lookalike-error">
          <span>{error}</span>
          <button type="button" onClick={findLookalikes}>
            Try again
          </button>
        </div>
      )}

      {loading && (
        <section className="lookalike-loading">
          <div className="lookalike-loading-icon">
            <Sparkles size={25} />
          </div>
          <h2>Finding your lookalikes</h2>
          <p>
            Comparing recommendations, genres, plot keywords
            and title metadata...
          </p>
          <div className="lookalike-progress">
            <span />
          </div>
        </section>
      )}

      {!loading && source && (
        <section className="lookalike-results-section">
          <div className="lookalike-section-heading">
            <div>
              <div className="lookalike-eyebrow">
                <Target size={14} />
                YOUR MATCH RESULTS
              </div>
              <h2>Because you liked {source.title}</h2>
              <p>
                Ranked using TMDB recommendations and metadata
                similarity.
              </p>
            </div>

            <button
              type="button"
              className="lookalike-reset-button"
              onClick={reset}
            >
              <RotateCcw size={15} />
              New search
            </button>
          </div>

          <div className="lookalike-source-card">
            <div className="lookalike-source-poster">
              {source.poster ? (
                <img src={source.poster} alt={source.title} />
              ) : (
                <Film size={25} />
              )}
            </div>
            <div>
              <small>YOU STARTED WITH</small>
              <h3>{source.title}</h3>
              <span>
                {source.mediaType === 'tv' ? 'SERIES' : 'MOVIE'}
                {source.year ? ` · ${source.year}` : ''}
              </span>
            </div>
          </div>

          {results.length > 0 ? (
            <>
              <div className="lookalike-results-count">
                <strong>{results.length} lookalikes found</strong>
                <span>Sorted by match strength</span>
              </div>

              <div className="lookalike-grid">
                {results.map((item, index) => (
                  <article
                    className="lookalike-card"
                    key={`${item.id}-${item.title}`}
                  >
                    <a
                      className="lookalike-card-image"
                      href={`https://www.themoviedb.org/${type}/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${item.title} on TMDB`}
                    >
                      {item.poster ? (
                        <img
                          src={item.poster}
                          alt={`${item.title} poster`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="lookalike-poster-fallback">
                          <Film size={30} />
                        </div>
                      )}

                      <span className="lookalike-rank">
                        #{index + 1}
                      </span>

                      <span className="lookalike-match-score">
                        <Sparkles size={12} />
                        {item.score}% match
                      </span>

                      <span className="lookalike-card-open">
                        <ArrowUpRight size={18} />
                      </span>
                    </a>

                    <div className="lookalike-card-body">
                      <div className="lookalike-card-meta">
                        <span>
                          {item.year || 'Year unknown'}
                        </span>
                        {item.rating !== null && (
                          <span className="lookalike-rating">
                            <Star size={12} fill="currentColor" />
                            {item.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      <h3>{item.title}</h3>

                      <p className="lookalike-overview">
                        {item.overview ||
                          'No synopsis available for this title.'}
                      </p>

                      <div className="lookalike-reasons">
                        <small>WHY IT MATCHES</small>
                        <div>
                          {item.reasons.map(reason => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      </div>

                      <a
                        className="lookalike-card-link"
                        href={`https://www.themoviedb.org/${type}/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explore title
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="lookalike-empty">
              <div><Search size={25} /></div>
              <h3>No lookalikes found</h3>
              <p>
                TMDB has not returned similar titles for this selection.
                Try another movie or series.
              </p>
              <button type="button" onClick={reset}>
                Search another title
              </button>
            </div>
          )}
        </section>
      )}

      {!loading && !source && !hasSearched && (
        <section className="lookalike-how">
          <div className="lookalike-how-heading">
            <span>BUILT FOR BETTER DISCOVERY</span>
            <h2>Not just the same genre.</h2>
            <p>
              Lookalike considers multiple signals to find titles
              that have more in common than a category label.
            </p>
          </div>

          <div className="lookalike-how-grid">
            <div>
              <span className="lookalike-how-icon"><Target size={20} /></span>
              <h3>TMDB intelligence</h3>
              <p>
                Starts with TMDB's recommendations and similar-title
                results for your selected movie or series.
              </p>
            </div>
            <div>
              <span className="lookalike-how-icon"><Search size={20} /></span>
              <h3>Plot keyword matching</h3>
              <p>
                Compares shared keywords and genres to identify
                stronger thematic connections.
              </p>
            </div>
            <div>
              <span className="lookalike-how-icon"><Star size={20} /></span>
              <h3>Ranked results</h3>
              <p>
                Combines relevance with language, release period
                and rating confidence to order the results.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="lookalike-footer">
        <p>
          Movie data and images by TMDB. This product uses the
          TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </main>
  );
}
