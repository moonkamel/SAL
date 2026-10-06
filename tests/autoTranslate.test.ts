import { afterEach, describe, expect, it, vi } from 'vitest';

describe('traduction automatique (API Claude simulée)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('traduit un lot et le garde en cache', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
      const texts = JSON.parse(body.messages[0]!.content) as string[];
      const json = { translations: texts.map((t) => `NL:${t}`) };
      return new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          content: [{ type: 'text', text: JSON.stringify(json) }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const { autoTranslate, lastTranslateError } = await import('@/server/autoTranslate');
    const out = await autoTranslate(['Tournoi de fléchettes', 'Pinte à 3€'], 'nl');
    expect(lastTranslateError).toBeUndefined();
    expect(out).toEqual(['NL:Tournoi de fléchettes', 'NL:Pinte à 3€']);
    await autoTranslate(['Tournoi de fléchettes'], 'nl');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
