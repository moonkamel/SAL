// Petit libellé contextuel de l'accueil : « SAMEDI SOIR · LILLE ».

const DAYS = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

export function momentOfDay(hour: number): string {
  if (hour < 5) return 'NUIT';
  if (hour < 11) return 'MATIN';
  if (hour < 14) return 'MIDI';
  if (hour < 18) return 'APRÈS-MIDI';
  return 'SOIR';
}

export function momentLabel(date: Date = new Date()): string {
  // Après minuit, on est encore « vendredi soir / nuit » pour sortir.
  const hour = date.getHours();
  const day = hour < 5 ? (date.getDay() + 6) % 7 : date.getDay();
  return `${DAYS[day]} ${momentOfDay(hour)} · LILLE`;
}
