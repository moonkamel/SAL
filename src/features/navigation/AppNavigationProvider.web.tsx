import type { ReactNode } from 'react';

// Le Navigation SDK est natif uniquement ; la cible web ne sert qu'aux routes API.
export function AppNavigationProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
