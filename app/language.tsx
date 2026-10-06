import { router } from 'expo-router';

import { LanguagePicker } from '@/src/i18n/LanguagePicker';

/** Changer de langue (depuis l'accueil). */
export default function LanguageScreen() {
  return <LanguagePicker onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
