/**
 * Centralized constants for the application.
 * Use these instead of hardcoded strings for consistency and type safety.
 */

// ============================================================================
// User Roles
// ============================================================================

/**
 * User role definitions for authorization.
 * 
 * @example
 * if (user.app_metadata.role === UserRole.ADMIN) { ... }
 * if (ADMIN_ROLES.includes(role)) { ... }
 */
export const UserRole = {
  ADMIN: 'admin',
  MOD_FINANCE: 'mod_finance',
  MOD_MEMBER: 'mod_member',
  MOD_CHALLENGE: 'mod_challenge',
  MOD_RACE: 'mod_race',
  MEMBER: 'member',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

/**
 * Roles that have full admin privileges
 */
export const ADMIN_ROLES = [UserRole.ADMIN] as const;

/**
 * Roles that have moderator privileges (can manage specific areas)
 */
export const MOD_ROLES = [
  UserRole.MOD_FINANCE,
  UserRole.MOD_MEMBER,
  UserRole.MOD_CHALLENGE,
  UserRole.MOD_RACE,
] as const;

/**
 * Roles that can access admin panel (admin + all mods)
 */
export const ADMIN_PANEL_ROLES = [
  UserRole.ADMIN,
  ...MOD_ROLES,
] as const;

// ============================================================================
// Cookie Names
// ============================================================================

export const CookieNames = {
  ACCESS_TOKEN: 'sb-access-token',
  REFRESH_TOKEN: 'sb-refresh-token',
  SESSION: 'sb-session',
  LEGACY_AUTH_TOKEN: 'supabase-auth-token',
} as const;

// ============================================================================
// Transaction Types & Statuses
// ============================================================================

export const PaymentStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const FlowType = {
  IN: 'in',   // Income
  OUT: 'out', // Expense
} as const;

// ============================================================================
// Challenge Statuses
// ============================================================================

export const ChallengeStatus = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
} as const;

// ============================================================================
// Reward Statuses
// ============================================================================

export const RewardStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
} as const;

export type RewardStatusType = typeof RewardStatus[keyof typeof RewardStatus];
