import type { Metadata, Viewport } from 'next';
import './globals.css';
import './home.css';
import './timeliner/timeliner.css';
import Script from 'next/script';
import SharedSiteChrome from './SharedSiteChrome';

export const metadata: Metadata = {
  title: 'REELRADAR — Find what to watch',
  description: 'Discover new movies, series and documentaries across languages and streaming platforms.',
  applicationName: 'REELRADAR',
};
export const viewport: Viewport = { themeColor: '#08090d', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <Script id="reelradar-splash-session" strategy="beforeInteractive">
          {`try {
            if (window.sessionStorage.getItem('reelradar-splash-shown')) {
              document.documentElement.dataset.rrSplashSkip = 'true';
            }
          } catch (_) {}`}
        </Script>
      </head>
      <body>
        <SharedSiteChrome>{children}</SharedSiteChrome>
      </body>
    </html>
  );
}
