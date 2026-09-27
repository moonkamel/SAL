import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Seules les requêtes tapées par l'utilisateur sont stockées (aucune donnée Google).
const KEY = 'search-history:v1';
const MAX_ENTRIES = 5;

export function addToHistory(history: string[], query: string): string[] {
  const clean = query.trim();
  if (!clean) return history;
  const rest = history.filter((q) => q.toLowerCase() !== clean.toLowerCase());
  return [clean, ...rest].slice(0, MAX_ENTRIES);
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((q): q is string => typeof q === 'string').slice(0, MAX_ENTRIES));
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: string[]) => {
    setHistory(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const add = useCallback(
    (query: string) => setHistory((prev) => {
      const next = addToHistory(prev, query);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    }),
    [],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { history, add, clear };
}
