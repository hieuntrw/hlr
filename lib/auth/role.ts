export type Role = 'admin' | 'superadmin' | 'mod' | 'member' | string | null;

export function getEffectiveRole(
  user: { app_metadata?: unknown } | null | undefined,
  profile?: { role?: string } | null
): Role {
  if (!user) return profile?.role ?? null;
  const appMeta = user.app_metadata as unknown;
  const roleFromSession = typeof appMeta === 'object' && appMeta !== null && 'role' in (appMeta as Record<string, unknown>)
    ? (appMeta as Record<string, unknown>)['role']
    : undefined;
  if (typeof roleFromSession === 'string') return roleFromSession as Role;
  return profile?.role ?? null;
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'superadmin';
}

export function isModRole(role: Role): boolean {
  return role === 'mod' || role === 'admin' || role === 'superadmin';
}
