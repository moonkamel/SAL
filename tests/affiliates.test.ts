import { afterEach, describe, expect, it, vi } from 'vitest';

import { fillTemplate, linksFor, loadPartners, partnerUrl } from '@/server/affiliates';
import example from '@/server/affiliates.example.json';

const PLACE = {
  id: 'ChIJ6TCpdF3VwkcRoxvGy4l48vc',
  name: "L'Estaminet & Co",
  address: '1 rue de la Monnaie, 59000 Lille',
  location: { lat: 50.6399, lng: 3.0628 },
};
const partners = loadPartners(example);

describe('liens partenaires', () => {
  it('valide le fichier d’exemple', () => {
    expect(partners.map((p) => p.id)).toEqual(['reservation', 'billetterie', 'vtc']);
    expect(loadPartners([{ id: 'x', kind: 'booking' }])).toEqual([]); // invalide → rien
    expect(
      loadPartners([{ ...example[2], urlTemplate: 'http://pas-https.fr/{name}' }]),
    ).toEqual([]);
  });

  it('encode les valeurs dans le modèle d’URL', () => {
    expect(fillTemplate('https://x.fr/?q={name}&c={city}&z={inconnu}', PLACE)).toBe(
      "https://x.fr/?q=L'Estaminet%20%26%20Co&c=Lille&z={inconnu}",
    );
  });

  it('préfère le lien direct du lieu au modèle', () => {
    const booking = partners[0]!;
    expect(partnerUrl(booking, PLACE)).toBe(
      'https://www.exemple-reservation.fr/restaurant/12345?affiliate=VOTRE_ID',
    );
    expect(partnerUrl(booking, { ...PLACE, id: 'autre-lieu-123' })).toContain('q=L');
  });

  it('choisit les partenaires selon le type de lieu', () => {
    const bar = { ...PLACE, id: 'bar-inconnu-123', types: ['bar', 'point_of_interest'] };
    expect(linksFor(bar, partners).map((l) => l.kind)).toEqual(['tickets', 'ride']);
    const resto = { ...PLACE, id: 'resto-inconnu-12', types: ['restaurant'] };
    expect(linksFor(resto, partners).map((l) => l.kind)).toEqual(['booking', 'ride']);
    // Lien direct : proposé même sans type correspondant.
    expect(linksFor({ ...PLACE, types: [] }, partners).map((l) => l.kind)).toEqual([
      'booking',
      'ride',
    ]);
    expect(linksFor(bar, [])).toEqual([]);
  });

  it('passe par /api/go avec les infos du lieu', () => {
    const [link] = linksFor({ ...PLACE, types: ['restaurant'] }, partners);
    expect(link?.path.startsWith('/api/go?p=reservation&place=ChIJ')).toBe(true);
  });
});

describe('/api/go', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/server/affiliates.json');
  });

  async function route() {
    vi.resetModules();
    vi.doMock('@/server/affiliates.json', () => ({ default: example }));
    return (await import('@/app/api/go+api')).GET;
  }

  it('compte le clic et redirige vers le partenaire', async () => {
    const GET = await route();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const [link] = linksFor({ ...PLACE, id: 'bar-inconnu-123', types: ['bar'] }, partners);
    const res = await GET(new Request(`http://x${link!.path}`));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(
      "https://www.exemple-billetterie.fr/lille/evenements?lieu=L'Estaminet%20%26%20Co&ref=VOTRE_ID",
    );
    expect(info).toHaveBeenCalledWith('[affiliate-click]', expect.stringContaining('billetterie'));
    info.mockRestore();
  });

  it('refuse un partenaire inconnu ou un lien incomplet', async () => {
    const GET = await route();
    expect((await GET(new Request('http://x/api/go?p=pirate&place=ChIJ6TCpdF3Vwk'))).status).toBe(
      404,
    );
    expect((await GET(new Request('http://x/api/go?p=vtc&place=ChIJ6TCpdF3Vwk'))).status).toBe(400);
  });
});
