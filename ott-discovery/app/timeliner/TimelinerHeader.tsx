
import Link from 'next/link';
import { ArrowLeft, Clock3, Film, GitMerge } from 'lucide-react';

export default function TimelinerHeader() {
  return (
    <>
      <header className="tl-topbar">
        <Link href="/" className="tl-back">
          <ArrowLeft size={16} />
          <span>REELRADAR</span>
        </Link>

        <nav aria-label="Main navigation">
          <Link href="/">Discover</Link>
          <Link href="/collide">
            <GitMerge size={15} />
            Movie Collide
          </Link>
          <Link href="/roulette">Movie Roulette</Link>
          <Link href="/timeliner" className="active">
            <Clock3 size={15} />
            Timeliner
          </Link>
        </nav>

        <Link href="/" className="tl-wordmark">
          <Film size={17} />
          <span>REELRADAR</span>
        </Link>
      </header>

      <style jsx>{`
        .tl-topbar {
          width: 100% !important;
          min-height: 76px !important;
          padding: 0 5% !important;
          box-sizing: border-box !important;
          display: grid !important;
          grid-template-columns: 1fr auto 1fr !important;
          align-items: center !important;
          gap: 24px !important;
          position: relative !important;
          z-index: 100 !important;
          background: #08090d !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        .tl-back {
          display: inline-flex !important;
          align-items: center !important;
          justify-self: start !important;
          gap: 10px !important;
          color: #f5f5f7 !important;
          text-decoration: none !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          white-space: nowrap !important;
        }

        .tl-back :global(svg) {
          color: #cfff00 !important;
          flex-shrink: 0 !important;
        }

        .tl-topbar nav {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 30px !important;
          min-width: 0 !important;
        }

        .tl-topbar nav a {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          color: #a7a7b0 !important;
          text-decoration: none !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          white-space: nowrap !important;
          transition: color 0.2s ease !important;
        }

        .tl-topbar nav a:hover,
        .tl-topbar nav a.active {
          color: #d5ff00 !important;
        }

        .tl-wordmark {
          display: inline-flex !important;
          align-items: center !important;
          justify-self: end !important;
          gap: 9px !important;
          color: #f5f5f7 !important;
          text-decoration: none !important;
          font-size: 16px !important;
          font-weight: 800 !important;
          letter-spacing: -0.5px !important;
          white-space: nowrap !important;
        }

        .tl-wordmark :global(svg) {
          color: #d5ff00 !important;
        }

        .tl-wordmark b {
          color: #d5ff00 !important;
        }

        @media (max-width: 760px) {
          .tl-topbar {
            min-height: auto !important;
            padding: 16px 18px 12px !important;
            grid-template-columns: 1fr auto !important;
            grid-template-rows: auto auto !important;
            gap: 18px 10px !important;
          }

          .tl-back {
            font-size: 14px !important;
          }

          .tl-wordmark {
            font-size: 14px !important;
          }

          .tl-topbar nav {
            grid-column: 1 / -1 !important;
            grid-row: 2 !important;
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 22px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 0 0 7px !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .tl-topbar nav::-webkit-scrollbar {
            display: none !important;
          }

          .tl-topbar nav a {
            font-size: 12px !important;
            flex-shrink: 0 !important;
          }
        }

        @media (max-width: 360px) {
          .tl-topbar {
            padding-left: 13px !important;
            padding-right: 13px !important;
          }

          .tl-topbar nav {
            gap: 17px !important;
          }
        }
      `}</style>
    </>
  );
}
