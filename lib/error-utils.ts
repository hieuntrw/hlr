export function errMessage(err: unknown): string {
  if (!err) return '';
  if (err instanceof Error) return err.message;
  try {
    const r = err as { message?: unknown };
    if (r && typeof r.message === 'string') return r.message;
  } catch {}
  try {
    return String(err);
  } catch {
    return '';
  }
}

export function asRecord<T = Record<string, unknown>>(v: unknown): T {
  return (v as T) ?? ({} as T);
}
