
import Link from 'next/link';
import { ArrowLeft, Film } from 'lucide-react';

export default function TimelinerHeader() {
  return (
    <>
      <header className="tl-topbar">
        <Link href="/" className="tl-back">
          <ArrowLeft size={17} />
          <span></span>
        </Link>

        <Link href="/" className="tl-wordmark">          
          <span>REELRADAR</span>
        </Link>
      </header>

      <style jsx>{`
        .tl-topbar {
          width: 100% !important;
          min-height: 68px !important;
          padding: 0 5% !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          background: #08090d !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          position: relative !important;
          z-index: 100 !important;
        }

        .tl-back,
        .tl-wordmark {
          display: inline-flex !important;
          align-items: center !important;
          gap: 10px !important;
          text-decoration: none !important;
          white-space: nowrap !important;
        }

        .tl-back {
          color: #c5c5ce !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          transition: color 0.2s ease !important;
        }

        .tl-back:hover {
          color: #d5ff00 !important;
        }

        .tl-back :global(svg),
        .tl-wordmark :global(svg) {
          color: #d5ff00 !important;
          flex-shrink: 0 !important;
        }

        .tl-wordmark {
          color: #f5f5f7 !important;
          font-size: 17px !important;
          font-weight: 800 !important;
          letter-spacing: -0.5px !important;
        }

        .tl-wordmark b {
          color: #d5ff00 !important;
        }

        @media (max-width: 600px) {
          .tl-topbar {
            min-height: 58px !important;
            padding: 0 18px !important;
          }

          .tl-back {
            font-size: 12px !important;
            gap: 7px !important;
          }

          .tl-wordmark {
            font-size: 15px !important;
            gap: 7px !important;
          }
        }
      `}</style>
    </>
  );
}
