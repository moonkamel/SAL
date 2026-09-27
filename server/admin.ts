// Accès à l'espace partenaires (/admin) : un mot de passe unique, ADMIN_PASSWORD,
// envoyé dans l'en-tête Authorization à chaque appel. Sans ce réglage, l'espace est fermé.

import { rateLimited } from './rateLimit';

export const MIN_PASSWORD_LENGTH = 12;

/** Comparaison en temps constant (ne révèle pas la longueur du préfixe correct). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Réponse d'erreur si l'appel n'est pas autorisé, sinon null. */
export function requireAdmin(request: Request): Response | null {
  const limited = rateLimited('admin', request);
  if (limited) return limited;

  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (expected.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `Espace partenaires fermé : définissez ADMIN_PASSWORD (${MIN_PASSWORD_LENGTH} caractères minimum).` },
      { status: 503 },
    );
  }
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!safeEqual(given, expected)) {
    return Response.json({ error: 'Mot de passe incorrect' }, { status: 401 });
  }
  return null;
}
