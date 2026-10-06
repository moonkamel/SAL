import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chip } from '@/src/components/Chip';
import { adminRequest, ApiRequestError, searchPlaces } from '@/src/lib/api';
import { colors, font, fonts, radius, spacing, TOUCH_TARGET } from '@/src/theme';
import { GRAND_PLACE } from '@/shared/geo';
import type { PlaceSummary } from '@/shared/types';
import type { UsageStats } from '@/server/analytics';

import {
  type ContentKind,
  DAY_LABELS,
  emptyValues,
  type Field,
  type FormValues,
  KINDS,
  toItem,
  toValues,
} from './fields';

type Tab = ContentKind | 'stats';
const TABS: { key: Tab; label: string }[] = [
  { key: 'offers', label: KINDS.offers.title },
  { key: 'events', label: KINDS.events.title },
  { key: 'sponsored', label: KINDS.sponsored.title },
  { key: 'affiliates', label: KINDS.affiliates.title },
  { key: 'stats', label: 'Statistiques' },
];

interface Status {
  database: boolean;
  openAgenda: boolean;
  clicks: { partner: string; placeId: string; clicks: number }[];
  clicksError?: string;
  usage?: UsageStats;
  usageError?: string;
}

const STORAGE_KEY = 'sal-admin-password';

function loadSaved(): string {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function save(password: string | null) {
  try {
    if (password) globalThis.sessionStorage?.setItem(STORAGE_KEY, password);
    else globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible : il faudra ressaisir le mot de passe.
  }
}

const message = (e: unknown) => (e instanceof ApiRequestError ? e.message : 'Une erreur est survenue.');

export function AdminPanel() {
  const [password, setPassword] = useState(loadSaved);
  const [status, setStatus] = useState<Status | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('offers');

  const login = useCallback(async (pwd: string) => {
    setLoginError(null);
    try {
      const s = await adminRequest<Status>(pwd, '/api/admin/status');
      save(pwd);
      setStatus(s);
    } catch (e) {
      save(null);
      setStatus(null);
      setLoginError(message(e));
    }
  }, []);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) void login(saved);
  }, [login]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>
          L’espace partenaires s’ouvre dans un navigateur, à l’adresse de votre serveur suivie de
          /admin.
        </Text>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.center}>
        <View style={styles.loginCard}>
          <Text style={styles.h1}>Espace partenaires</Text>
          <Text style={styles.muted}>Bons plans, agenda, lieux sponsorisés et liens partenaires.</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void login(password)}
            placeholder="Mot de passe (ADMIN_PASSWORD)"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoFocus
            style={styles.input}
            accessibilityLabel="Mot de passe"
          />
          {loginError && <Text style={styles.error}>{loginError}</Text>}
          <Button label="Entrer" onPress={() => void login(password)} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Espace partenaires</Text>
        <Button
          label="Se déconnecter"
          variant="ghost"
          onPress={() => {
            save(null);
            setPassword('');
            setStatus(null);
          }}
        />
      </View>
      <Text style={status.database ? styles.ok : styles.warn}>
        {status.database
          ? 'Base de données connectée : vos modifications sont en ligne en moins d’une minute.'
          : 'Base de données non configurée : lecture seule (fichiers JSON du serveur). Voir le README, « Espace partenaires ».'}
      </Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </View>
      {tab === 'stats' ? (
        <Stats status={status} />
      ) : (
        <ContentEditor key={tab} kind={tab} password={password} canWrite={status.database} />
      )}
    </ScrollView>
  );
}

// Libellés lisibles des écrans de l'app (statistiques).
const SCREEN_NAMES: Record<string, string> = {
  '/': 'Accueil',
  '/results': 'Résultats de recherche',
  '/place/[id]': 'Fiche d’un lieu',
  '/route/[id]': 'Itinéraire',
  '/transit/[id]': 'Transports (horaires)',
  '/agenda': 'Agenda',
  '/event/[id]': 'Fiche d’un événement',
  '/offers': 'Bons plans',
  '/favorites': 'Favoris',
  '/language': 'Choix de la langue',
  '/privacy': 'Confidentialité',
};
const screenName = (s: string) => SCREEN_NAMES[s] ?? s;
const MODE_NAMES: Record<string, string> = { walking: 'À pied', bicycle: 'Vélo', driving: 'Voiture', transit: 'Transports' };

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.count}>
          {value}
          {suffix ? <Text style={styles.muted}> {suffix}</Text> : null}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }]} />
      </View>
    </View>
  );
}

function Usage({ usage }: { usage: UsageStats }) {
  const maxDay = Math.max(1, ...usage.perDay.map((d) => d.sessions));
  const opened = usage.funnel[0]?.sessions ?? 0;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.h2}>Utilisation ({usage.days} derniers jours)</Text>
        <Text style={styles.text}>
          <Text style={styles.count}>{usage.sessions}</Text> ouvertures de l’app
        </Text>
        <View style={styles.chart}>
          {usage.perDay.map((d) => (
            <View key={d.day} style={styles.chartCol} accessibilityLabel={`${d.day} : ${d.sessions}`}>
              <View style={[styles.chartBar, { height: `${(d.sessions / maxDay) * 100}%` }]} />
            </View>
          ))}
        </View>
        <Text style={styles.help}>Une barre par jour (ouvertures de l’app).</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Parcours</Text>
        <Text style={styles.help}>Sur 100 ouvertures, combien vont jusqu’à chaque étape (une même ouverture compte une fois).</Text>
        {usage.funnel.map((f) => (
          <Bar
            key={f.step}
            label={f.step}
            value={f.sessions}
            max={opened}
            suffix={opened ? `(${Math.round((f.sessions / opened) * 100)} %)` : undefined}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Recherches les plus fréquentes</Text>
        {usage.searches.length === 0 ? (
          <Text style={styles.muted}>Aucune recherche pour le moment.</Text>
        ) : (
          usage.searches.map((q) => (
            <Bar key={q.query} label={`${q.query}  ·  ${q.avgResults} résultats en moyenne`} value={q.count} max={usage.searches[0]!.count} />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Recherches sans résultat</Text>
        <Text style={styles.help}>Ce que les gens cherchent sans rien trouver : idées de contenus ou de partenaires.</Text>
        {usage.emptySearches.length === 0 ? (
          <Text style={styles.muted}>Aucune.</Text>
        ) : (
          usage.emptySearches.map((q) => <Bar key={q.query} label={q.query} value={q.count} max={usage.emptySearches[0]!.count} />)
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Écrans les plus vus</Text>
        {usage.screens.map((s) => (
          <Bar key={s.screen} label={screenName(s.screen)} value={s.views} max={usage.screens[0]?.views ?? 1} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Où les gens quittent l’app</Text>
        <Text style={styles.help}>Dernier écran vu avant de fermer l’app ou de partir vers Google Maps.</Text>
        {usage.exits.map((s) => (
          <Bar key={s.screen} label={screenName(s.screen)} value={s.sessions} max={usage.exits[0]?.sessions ?? 1} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Itinéraires lancés et langues</Text>
        {usage.directions.map((d) => (
          <Bar key={d.mode} label={MODE_NAMES[d.mode] ?? d.mode} value={d.count} max={usage.directions[0]?.count ?? 1} />
        ))}
        <Text style={styles.muted}>
          {usage.languages.map((l) => `${l.lang.toUpperCase()} ${l.sessions}`).join(' · ')}
        </Text>
      </View>
    </>
  );
}

function Stats({ status }: { status: Status }) {
  if (!status.database) {
    return <Text style={styles.muted}>Les statistiques sont enregistrées dans la base de données (non configurée).</Text>;
  }
  return (
    <>
      {status.usageError ? (
        <Text style={styles.error}>
          {status.usageError} — avez-vous créé la table « events » (supabase/schema.sql) ?
        </Text>
      ) : status.usage ? (
        <Usage usage={status.usage} />
      ) : null}
      <View style={styles.card}>
        <Text style={styles.h2}>Clics sur les liens partenaires (30 derniers jours)</Text>
        {status.clicksError ? (
          <Text style={styles.error}>{status.clicksError}</Text>
        ) : status.clicks.length === 0 ? (
          <Text style={styles.muted}>Aucun clic pour le moment.</Text>
        ) : (
          status.clicks.map((c) => (
            <View key={`${c.partner}|${c.placeId}`} style={styles.row}>
              <Text style={[styles.text, { flex: 1 }]}>
                {c.partner} · <Text style={styles.muted}>{c.placeId}</Text>
              </Text>
              <Text style={styles.count}>{c.clicks}</Text>
            </View>
          ))
        )}
        <Text style={styles.muted}>Agenda OpenAgenda : {status.openAgenda ? 'activé' : 'non configuré'}.</Text>
      </View>
    </>
  );
}

function ContentEditor({
  kind,
  password,
  canWrite,
}: {
  kind: ContentKind;
  password: string;
  canWrite: boolean;
}) {
  const config = KINDS[kind];
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormValues | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await adminRequest<{ items: Record<string, unknown>[] }>(
        password,
        `/api/admin/content?kind=${kind}`,
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [kind, password]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = async (id: string) => {
    if (!globalThis.confirm?.(`Supprimer « ${id} » ?`)) return;
    try {
      await adminRequest(password, `/api/admin/content?kind=${kind}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      await reload();
    } catch (e) {
      setError(message(e));
    }
  };

  if (editing) {
    return (
      <ItemForm
        kind={kind}
        initial={editing}
        password={password}
        canWrite={canWrite}
        onDone={() => {
          setEditing(null);
          void reload();
        }}
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.headerRow}>
        <Text style={styles.h2}>{config.title}</Text>
        {canWrite && (
          <Button label={`Ajouter un ${config.singular}`} onPress={() => setEditing(emptyValues(config.fields))} />
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {!items ? (
        <ActivityIndicator color={colors.accent} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>Rien pour le moment.</Text>
      ) : (
        items.map((item) => (
          <View key={String(item.id)} style={styles.itemRow}>
            <Text style={[styles.text, { flex: 1 }]}>{config.summary(item)}</Text>
            <Button label={canWrite ? 'Modifier' : 'Voir'} variant="ghost" onPress={() => setEditing(toValues(config.fields, item))} />
            {canWrite && <Button label="Supprimer" variant="danger" onPress={() => void remove(String(item.id))} />}
          </View>
        ))
      )}
    </View>
  );
}

function ItemForm({
  kind,
  initial,
  password,
  canWrite,
  onDone,
}: {
  kind: ContentKind;
  initial: FormValues;
  password: string;
  canWrite: boolean;
  onDone: () => void;
}) {
  const config = KINDS[kind];
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async () => {
    const result = toItem(config.fields, values);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminRequest(password, `/api/admin/content?kind=${kind}`, {
        method: 'POST',
        body: result.item,
      });
      onDone();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { gap: spacing.lg }]}>
      <Text style={styles.h2}>{config.title}</Text>
      {config.place && (
        <PlaceFinder
          onPick={(p) => {
            const b = config.place!;
            setValues((v) => ({
              ...v,
              ...(b.placeId ? { [b.placeId]: p.id } : {}),
              ...(b.name ? { [b.name]: p.name } : {}),
              [b.lat]: String(p.location.lat),
              [b.lng]: String(p.location.lng),
              ...(kind === 'events' && !v.address ? { address: p.address } : {}),
            }));
          }}
        />
      )}
      {config.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => set(f.key, v)} />
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        <Button label="Annuler" variant="ghost" onPress={onDone} />
        {canWrite && <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={() => void submit()} />}
      </View>
    </View>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  let control: React.ReactNode;
  if (field.type === 'bool') {
    control = (
      <Switch
        value={value === 'true'}
        onValueChange={(v) => onChange(String(v))}
        trackColor={{ true: colors.accent, false: colors.border }}
        accessibilityLabel={field.label}
      />
    );
  } else if (field.type === 'select') {
    control = (
      <View style={styles.tabs}>
        {field.options!.map((o) => (
          <Chip key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    );
  } else if (field.type === 'days') {
    const selected = new Set(value.split(',').filter(Boolean).map(Number));
    // Affichage du lundi au dimanche.
    control = (
      <View style={styles.tabs}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <Chip
            key={d}
            label={DAY_LABELS[d]!}
            selected={selected.has(d)}
            onPress={() => {
              const next = new Set(selected);
              if (next.has(d)) next.delete(d);
              else next.add(d);
              onChange([...next].sort().join(','));
            }}
          />
        ))}
      </View>
    );
  } else {
    control = (
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={colors.textFaint}
        multiline={field.type === 'textarea' || field.type === 'json'}
        style={[styles.input, (field.type === 'textarea' || field.type === 'json') && { minHeight: 80 }]}
        accessibilityLabel={field.label}
        autoCapitalize="none"
      />
    );
  }
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.label}>
        {field.label}
        {field.optional ? <Text style={styles.muted}> (facultatif)</Text> : null}
      </Text>
      {control}
      {field.help && <Text style={styles.help}>{field.help}</Text>}
    </View>
  );
}

function PlaceFinder({ onPick }: { onPick: (p: PlaceSummary) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await searchPlaces({ query, location: GRAND_PLACE });
      setResults(res.places.slice(0, 6));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.finder}>
      <Text style={styles.label}>Chercher le lieu (remplit place_id, nom et position)</Text>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void find()}
          placeholder="Nom de l’établissement"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { flex: 1 }]}
          accessibilityLabel="Chercher un lieu"
        />
        <Button label={busy ? '…' : 'Chercher'} onPress={() => void find()} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {results.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => {
            onPick(p);
            setResults([]);
          }}
          style={({ pressed }) => [styles.result, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.text}>{p.name}</Text>
          <Text style={styles.muted}>{p.address}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Button({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'ghost' && { backgroundColor: colors.surfaceRaised },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.closed },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'danger' && { color: colors.closed },
          variant === 'ghost' && { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  page: { padding: spacing.xl, gap: spacing.lg, maxWidth: 860, width: '100%', alignSelf: 'center' },
  loginCard: { width: '100%', maxWidth: 420, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  h1: { color: colors.text, fontFamily: fonts.display, fontSize: font.title + 4 },
  h2: { color: colors.text, fontFamily: fonts.displayMedium, fontSize: font.title - 2 },
  text: { color: colors.text, fontSize: font.body },
  label: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: font.small },
  help: { color: colors.textFaint, fontSize: font.tiny },
  ok: { color: colors.open, fontSize: font.small },
  warn: { color: colors.gold, fontSize: font.small },
  error: { color: colors.closed, fontSize: font.small },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  count: { color: colors.gold, fontSize: font.body, fontWeight: '800' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90, marginTop: spacing.sm },
  chartCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBar: { backgroundColor: colors.gold, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  input: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: font.body,
  },
  finder: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  result: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  button: {
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.accentText, fontSize: font.small, fontWeight: '700' },
});
