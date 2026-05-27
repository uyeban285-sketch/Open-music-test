import type { Metadata } from 'next';

import { Providers } from '../providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Open Music',
  description: 'Multi-source music aggregator with AI recommendations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
