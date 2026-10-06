import { requireAdmin } from '@/server/admin';
import { deleteContent, hasDatabase, listRaw, putContent, StoreError } from '@/server/content';
import { CONTENT_KINDS, CONTENT_SCHEMAS, type ContentKind, describeIssues } from '@/server/schemas';
import { tx } from '@/shared/i18n';

function kindOf(request: Request): ContentKind | null {
  const kind = new URL(request.url).searchParams.get('kind') as ContentKind | null;
  return kind && CONTENT_KINDS.includes(kind) ? kind : null;
}

function storeError(error: unknown): Response {
  if (error instanceof StoreError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('[api/admin/content]', error);
  return Response.json({ error: tx('Erreur interne') }, { status: 500 });
}

/** GET /api/admin/content?kind=offers → tous les éléments (même invalides ou inactifs). */
export async function GET(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const kind = kindOf(request);
  if (!kind) return Response.json({ error: tx('Type de contenu inconnu') }, { status: 400 });
  try {
    return Response.json({ items: await listRaw(kind), database: hasDatabase() });
  } catch (error) {
    return storeError(error);
  }
}

/** POST /api/admin/content?kind=offers — crée ou remplace un élément (même id). */
export async function POST(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const kind = kindOf(request);
  if (!kind) return Response.json({ error: tx('Type de contenu inconnu') }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: tx('Données invalides') }, { status: 400 });
  }
  const parsed = CONTENT_SCHEMAS[kind].safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: describeIssues(parsed.error) }, { status: 422 });
  }
  try {
    await putContent(kind, parsed.data.id, parsed.data);
    return Response.json({ ok: true, item: parsed.data });
  } catch (error) {
    return storeError(error);
  }
}

/** DELETE /api/admin/content?kind=offers&id=… */
export async function DELETE(request: Request): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const kind = kindOf(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!kind || !id) return Response.json({ error: tx('Paramètres invalides') }, { status: 400 });
  try {
    await deleteContent(kind, id);
    return Response.json({ ok: true });
  } catch (error) {
    return storeError(error);
  }
}
