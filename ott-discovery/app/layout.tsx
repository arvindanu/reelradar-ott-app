import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'REELRADAR — Find what to watch',
  description: 'Discover new movies, series and documentaries across languages and streaming platforms.',
  applicationName: 'REELRADAR',
};
export const viewport: Viewport = { themeColor: '#08090d', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
