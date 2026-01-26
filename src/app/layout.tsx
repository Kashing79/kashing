import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kashing - Global News Aggregator',
  description: 'Real-time global news aggregation covering Politics, Finance, Economy, and Society',
  keywords: ['news', 'politics', 'finance', 'economy', 'global', 'aggregator'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
