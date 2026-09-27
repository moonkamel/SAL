import { createContext, type ReactNode, useContext } from 'react';

// Pas de publicité sur la cible web (elle ne sert qu'aux routes API).
const value = {
  canRequestAds: false,
  privacyOptionsRequired: false,
  showPrivacyOptions: async () => {},
  onSearch: () => {},
};
const AdsContext = createContext(value);

export function AdsProvider({ children }: { children: ReactNode }) {
  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds() {
  return useContext(AdsContext);
}
