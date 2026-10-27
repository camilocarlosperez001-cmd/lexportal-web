/** Autenticación interna: no acepta JWT de usuario ni secretos desde el payload. */
export function authorizedWebhook(provided: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !provided || provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function webhookNotificationId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (value.type !== 'INSERT' || value.schema !== 'public' || value.table !== 'notificaciones') return null;
  if (!value.record || typeof value.record !== 'object' || Array.isArray(value.record)) return null;
  const id = (value.record as Record<string, unknown>).id;
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
