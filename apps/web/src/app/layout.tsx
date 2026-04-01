import './global.css';
import { ReactNode } from 'react';
import { AppShellLoader } from '@/components/AppShellLoader';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata = {
  title: 'SocialDrop',
  description: 'Social media scheduler',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AppShellLoader>{children}</AppShellLoader>
        </ThemeProvider>
      </body>
    </html>
  );
}
