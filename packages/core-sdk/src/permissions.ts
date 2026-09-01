import type { EffectivePermissions } from './types';

/**
 * Enforcement helpers (Section 6.3).
 *
 * The contract requires permissions to be functional rather than merely
 * stored: they must demonstrably determine what a user can reach. These are
 * what route handlers call.
 *
 * Default deny throughout. A null permission set means no membership, no app
 * assignment, or an unresolved context, and every one of those is a denial
 * rather than a reason to skip the check.
 */

export function hasPermission(
  permissions: EffectivePermissions | null | undefined,
  key: string,
): boolean {
  if (!permissions) return false;
  return permissions.effective.includes(key);
}

export class PermissionDeniedError extends Error {
  constructor(readonly required: string) {
    super(`Permission denied: ${required}`);
    this.name = 'PermissionDeniedError';
  }
}

/** Throws unless the permission is held. Intended for route handlers. */
export function requirePermission(
  permissions: EffectivePermissions | null | undefined,
  key: string,
): void {
  if (!hasPermission(permissions, key)) throw new PermissionDeniedError(key);
}
