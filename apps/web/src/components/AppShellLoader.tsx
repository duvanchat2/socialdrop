'use client';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const AppShellDynamic = dynamic(
  () => import('./AppShell').then((m) => m.AppShell),
  { ssr: false, loading: () => null }
);

export function AppShellLoader({ children }: { children: ReactNode }) {
  return <AppShellDynamic>{children}</AppShellDynamic>;
}
