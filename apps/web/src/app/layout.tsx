import './global.css';
import { ReactNode } from 'react';
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google';
import { AppShellLoader } from '@/components/AppShellLoader';
import { ThemeProvider } from '@/components/ThemeProvider';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

// Satoshi (spec'd body font) requires a manually-downloaded woff2 from
// Fontshare — using Manrope (next/font/google, self-hosted, same
// geometric-sans category) as a self-hostable stand-in instead.
const bodySans = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata = {
  title: 'SocialDrop',
  description: 'Social media scheduler',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      className={`dark ${spaceGrotesk.variable} ${bodySans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="bg-base text-ink font-body min-h-screen"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AppShellLoader>{children}</AppShellLoader>
        </ThemeProvider>
      </body>
    </html>
  );
}
