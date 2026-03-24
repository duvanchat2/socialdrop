import './global.css';
import { ReactNode } from 'react';
import { AppShellLoader } from '@/components/AppShellLoader';

export const metadata = {
  title: 'SocialDrop',
  description: 'Social media scheduler',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen" suppressHydrationWarning>
        <AppShellLoader>{children}</AppShellLoader>
      </body>
    </html>
  );
}
