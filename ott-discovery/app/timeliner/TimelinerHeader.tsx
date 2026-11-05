import Link from 'next/link';
import { ArrowLeft, Clock3, Film, GitMerge } from 'lucide-react';

export default function TimelinerHeader() {
  return <header className="tl-topbar">
    <Link href="/" className="tl-back"><ArrowLeft size={15}/> REELRADAR</Link>
    <nav aria-label="Main navigation">
      <Link href="/">Discover</Link><Link href="/collide"><GitMerge size={14}/> Movie Collide</Link>
      <Link href="/roulette">Movie Roulette</Link><Link href="/timeliner" className="active"><Clock3 size={14}/> Timeliner</Link>
    </nav>
    <span className="tl-wordmark"><Film size={16}/> REEL<b>RADAR</b></span>
  </header>;
}
