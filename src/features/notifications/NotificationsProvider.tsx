// Notifications locales, programmées sur le téléphone (aucun serveur push) :
// - le vendredi 17 h 45, le programme du week-end (activé si l'utilisateur accepte) ;
// - le mardi et le jeudi 17 h, les bons plans de l'afterwork (en option) ;
// - les rappels d'événements choisis (« Me le rappeler »), 2 h avant.
// Les textes sont recalculés à chaque ouverture de l'app, dans la langue choisie.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useUserLocation } from '@/src/features/location/LocationProvider';
import { useI18n } from '@/src/i18n';
import { track } from '@/src/lib/analytics';
import { getAgenda, rememberEvent } from '@/src/lib/api';
import { type Lang, translate } from '@/shared/i18n';
import type { AgendaEvent, LatLng } from '@/shared/types';

import { AFTERWORK_AT, nextWeekdays, reminderTime, WEEKEND_AT, weekendDigest } from './schedule';

const PREFS_KEY = 'sal.notif.v1';
const REMINDERS_KEY = 'sal.reminders.v1';
const CHANNEL = 'sorties';

export interface NotificationPrefs {
  weekend: boolean;
  afterwork: boolean;
  /** L'invitation de l'accueil a déjà reçu une réponse. */
  asked: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { weekend: false, afterwork: false, asked: false };

interface NotificationsState {
  prefs: NotificationPrefs;
  /** Permission accordée par le système (null : pas encore demandé). */
  granted: boolean | null;
  /** Active un type de notification (demande la permission si besoin) ; false si refusée. */
  setPref: (key: 'weekend' | 'afterwork', on: boolean) => Promise<boolean>;
  /** Réponse à l'invitation de l'accueil. */
  answerInvite: (accept: boolean) => Promise<void>;
  isReminded: (id: string) => boolean;
  /** Programme ou annule le rappel d'un événement ; renvoie l'état final. */
  toggleReminder: (event: AgendaEvent) => Promise<boolean>;
  reminders: AgendaEvent[];
}

const Ctx = createContext<NotificationsState | null>(null);

// Affichées même quand l'app est ouverte (pas de notifications sur le site web).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android 8+ : un canal est nécessaire (et sur Android 13+, avant la demande).
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Sorties à Lille',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const trigger = (date: Date): Notifications.NotificationTriggerInput => ({
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  date,
  ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
});

/** Reprogramme les envois réguliers (week-end, afterwork) avec des textes à jour. */
async function scheduleDigests(prefs: NotificationPrefs, lang: Lang, coords: LatLng): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'weekend' || n.content.data?.kind === 'afterwork')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  const now = new Date();

  if (prefs.weekend) {
    const fridays = nextWeekdays(now, [WEEKEND_AT.weekday], WEEKEND_AT.hour, WEEKEND_AT.minute, 4);
    // Le prochain vendredi est celui de cette semaine : on annonce les vraies sorties.
    let first = weekendDigest([], lang);
    if (fridays[0] && fridays[0].getTime() - now.getTime() < 5 * 86_400_000 && now.getDay() !== 0 && now.getDay() !== 6) {
      try {
        first = weekendDigest((await getAgenda(coords, 'weekend')).events, lang);
      } catch {
        // Hors connexion : texte général.
      }
    }
    for (const [i, date] of fridays.entries()) {
      const content = i === 0 ? first : weekendDigest([], lang);
      await Notifications.scheduleNotificationAsync({
        content: { ...content, data: { kind: 'weekend', url: '/agenda?when=weekend' } },
        trigger: trigger(date),
      });
    }
  }

  if (prefs.afterwork) {
    const dates = nextWeekdays(now, AFTERWORK_AT.weekdays, AFTERWORK_AT.hour, AFTERWORK_AT.minute, 6);
    for (const date of dates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: translate(lang, 'C’est l’heure de l’afterwork'),
          body: translate(lang, 'Les bons plans du jour autour de vous : pintes, cocktails, tapas…'),
          data: { kind: 'afterwork', url: '/offers' },
        },
        trigger: trigger(date),
      });
    }
  }
}

function NativeNotificationsProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const { coords } = useUserLocation();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [reminders, setReminders] = useState<Record<string, AgendaEvent & { notificationId: string }>>({});
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  // Préférences et rappels enregistrés sur le téléphone.
  useEffect(() => {
    void (async () => {
      try {
        const [p, r] = await Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(REMINDERS_KEY)]);
        if (p) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(p) as Partial<NotificationPrefs>) });
        if (r) {
          const all = JSON.parse(r) as Record<string, AgendaEvent & { notificationId: string }>;
          // Les rappels passés sont oubliés ; les autres restent consultables hors agenda.
          const upcoming = Object.fromEntries(
            Object.entries(all).filter(([, e]) => new Date(e.start).getTime() > Date.now()),
          );
          Object.values(upcoming).forEach(rememberEvent);
          setReminders(upcoming);
        }
        setGranted((await Notifications.getPermissionsAsync()).granted);
      } catch {
        // Stockage illisible : valeurs par défaut.
      }
      setLoaded(true);
    })();
  }, []);

  // Textes à jour à chaque ouverture et changement de langue.
  useEffect(() => {
    if (!loaded || !granted || (!prefs.weekend && !prefs.afterwork)) return;
    void scheduleDigests(prefs, lang, coordsRef.current).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, granted, prefs.weekend, prefs.afterwork, lang]);

  // Toucher une notification ouvre le bon écran.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const id = response?.notification.request.identifier;
    const url = response?.notification.request.content.data?.url;
    if (!id || handled.current === id || typeof url !== 'string') return;
    handled.current = id;
    track('notifications', { opened: String(response?.notification.request.content.data?.kind ?? '') });
    router.push(url as never);
  }, [response]);

  const savePrefs = useCallback((next: NotificationPrefs) => {
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setPref = useCallback(
    async (key: 'weekend' | 'afterwork', on: boolean) => {
      if (on && !(await ensurePermission())) {
        setGranted(false);
        return false;
      }
      if (on) setGranted(true);
      savePrefs({ ...prefs, [key]: on, asked: true });
      if (!on) {
        // Plus rien à envoyer de ce type : on annule tout de suite.
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(
          scheduled
            .filter((n) => n.content.data?.kind === key)
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
        );
      }
      return true;
    },
    [prefs, savePrefs],
  );

  const answerInvite = useCallback(
    async (accept: boolean) => {
      if (accept) {
        const ok = await setPref('weekend', true);
        if (!ok) savePrefs({ ...prefs, asked: true });
      } else {
        savePrefs({ ...prefs, asked: true });
      }
    },
    [prefs, savePrefs, setPref],
  );

  const saveReminders = useCallback((next: typeof reminders) => {
    setReminders(next);
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const toggleReminder = useCallback(
    async (event: AgendaEvent) => {
      const existing = reminders[event.id];
      if (existing) {
        await Notifications.cancelScheduledNotificationAsync(existing.notificationId).catch(() => {});
        const { [event.id]: _removed, ...rest } = reminders;
        saveReminders(rest);
        return false;
      }
      const at = reminderTime(new Date(event.start), new Date());
      if (!at || !(await ensurePermission())) return false;
      setGranted(true);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: translate(lang, 'Bientôt : {title}', { title: event.title }),
          body: `${event.venueName} · ${event.dateLabel}`,
          data: { kind: 'reminder', url: `/event/${encodeURIComponent(event.id)}` },
        },
        trigger: trigger(at),
      });
      track('reminder', { source: event.source });
      saveReminders({ ...reminders, [event.id]: { ...event, notificationId } });
      return true;
    },
    [lang, reminders, saveReminders],
  );

  const value = useMemo<NotificationsState>(
    () => ({
      prefs,
      granted,
      setPref,
      answerInvite,
      isReminded: (id) => !!reminders[id],
      toggleReminder,
      reminders: Object.values(reminders).sort((a, b) => a.start.localeCompare(b.start)),
    }),
    [prefs, granted, setPref, answerInvite, reminders, toggleReminder],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Site web (espace partenaires, confidentialité) : rien à programmer.
const WEB_STATE: NotificationsState = {
  prefs: { ...DEFAULT_PREFS, asked: true },
  granted: false,
  setPref: async () => false,
  answerInvite: async () => {},
  isReminded: () => false,
  toggleReminder: async () => false,
  reminders: [],
};

function WebNotificationsProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={WEB_STATE}>{children}</Ctx.Provider>;
}

export const NotificationsProvider = Platform.OS === 'web' ? WebNotificationsProvider : NativeNotificationsProvider;

export function useNotifications(): NotificationsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications doit être utilisé dans <NotificationsProvider>');
  return ctx;
}
