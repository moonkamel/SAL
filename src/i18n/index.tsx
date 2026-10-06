import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isLang, type Lang, LANG_INFO, translate, type Vars } from '@/shared/i18n';

export { tx } from '@/shared/i18n';

const STORAGE_KEY = 'sal.lang.v1';

// Langue courante, lisible hors de React (appels à l'API).
let current: Lang = 'fr';
export function currentLang(): Lang {
  return current;
}

/** Langue du téléphone si elle est proposée, sinon l'anglais pour les visiteurs. */
export function deviceLang(): Lang {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
    return isLang(code) ? code : 'en';
  } catch {
    return 'fr';
  }
}

export type T = (text: string, vars?: Vars) => string;

interface I18n {
  lang: Lang;
  /** La personne a déjà choisi sa langue (sinon : écran de choix au lancement). */
  chosen: boolean;
  /** Préférence chargée depuis le stockage. */
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: T;
  /** Locale Intl (dates, heures). */
  locale: string;
}

const I18nContext = createContext<I18n>({
  lang: 'fr',
  chosen: true,
  ready: true,
  setLang: () => {},
  t: (text, vars) => translate('fr', text, vars),
  locale: 'fr-FR',
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isLang(saved)) {
          current = saved;
          setLangState(saved);
          setChosen(true);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((next: Lang) => {
    current = next;
    setLangState(next);
    setChosen(true);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      chosen,
      ready,
      setLang,
      t: (text, vars) => translate(lang, text, vars),
      locale: LANG_INFO[lang].locale,
    }),
    [lang, chosen, ready, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** Fonction de traduction de la langue choisie. */
export function useT(): T {
  return useContext(I18nContext).t;
}
