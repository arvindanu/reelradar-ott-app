
import { Clapperboard } from 'lucide-react';

export default function GlobalFooter() {
  return (
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
  );
}
