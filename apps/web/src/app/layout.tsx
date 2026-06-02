import type { Metadata } from 'next';
import './globals.css';
import { NO_FLASH_SCRIPT } from '@/lib/theme';
import { PreviewBanner } from '@/components/ui';

export const metadata: Metadata = {
  title: 'ParkSphere Enterprise — Smart Parking Intelligence',
  description: 'Enterprise QR Monthly Smart Parking Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The data-theme attribute is set by the inline script below BEFORE
    // first paint (reads localStorage). React hydration will then match
    // because useTheme() reads the same DOM attribute on mount.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body className="font-sans">
        <PreviewBanner />
        {children}
      </body>
    </html>
  );
}
