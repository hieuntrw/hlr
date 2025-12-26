import { ADMIN_ROLES, MOD_ROLES, type UserRoleType } from '@/lib/constants';

export type Role = UserRoleType | string | null;

export function getEffectiveRole(
  user: { app_metadata?: unknown } | null | undefined,
): Role {
  if (!user) return null;
  const appMeta = user.app_metadata as unknown;
  const roleFromSession = typeof appMeta === 'object' && appMeta !== null && 'role' in (appMeta as Record<string, unknown>)
    ? (appMeta as Record<string, unknown>)['role']
    : undefined;
  if (typeof roleFromSession === 'string') return roleFromSession as Role;
  return null;
}

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

export function isModRole(role: Role): boolean {
  return MOD_ROLES.includes(role as typeof MOD_ROLES[number]);
}

// ============================================================================
// UNUSED: isPrivilegedRole is not used anywhere in the codebase.
// Marked for potential deletion - Dec 2024
// ============================================================================
/* UNUSED - isPrivilegedRole
export function isPrivilegedRole(role: Role): boolean {
  return isAdminRole(role) || isModRole(role);
}
*/

// Re-export constants for convenience
export { UserRole, ADMIN_ROLES, MOD_ROLES, type UserRoleType } from '@/lib/constants';
