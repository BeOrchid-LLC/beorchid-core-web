/**
 * Enforcement helpers (Section 6.3).
 *
 * These decide whether a route runs, so the cases that matter most are the ones
 * where the permission set is absent or malformed rather than the happy path.
 * Every one of those must deny.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasPermission, PermissionDeniedError, requirePermission } from '../src/permissions.ts';
import type { EffectivePermissions } from '../src/types.ts';

const set = (effective: string[]): EffectivePermissions => ({
  membershipId: 'm1',
  appId: 'a1',
  orgWide: [],
  appScoped: [],
  effective,
});

describe('hasPermission', () => {
  it('grants a permission that is held', () => {
    assert.equal(hasPermission(set(['leads:read']), 'leads:read'), true);
  });

  it('denies a permission that is not held', () => {
    assert.equal(hasPermission(set(['leads:read']), 'leads:delete'), false);
  });

  it('denies when the permission set is null', () => {
    // Null means no membership, no app assignment, or an unresolved context.
    // Every one of those is a denial, not a reason to skip the check.
    assert.equal(hasPermission(null, 'leads:read'), false);
  });

  it('denies when the permission set is undefined', () => {
    assert.equal(hasPermission(undefined, 'leads:read'), false);
  });

  it('denies on an empty effective set', () => {
    assert.equal(hasPermission(set([]), 'leads:read'), false);
  });

  it('is case sensitive, so a near-miss key does not grant', () => {
    assert.equal(hasPermission(set(['leads:read']), 'Leads:Read'), false);
  });

  it('does not treat a prefix as a match', () => {
    // 'leads:read' must not satisfy 'leads:read:all' or vice versa.
    assert.equal(hasPermission(set(['leads:read']), 'leads:read:all'), false);
    assert.equal(hasPermission(set(['leads:read:all']), 'leads:read'), false);
  });

  it('reads only the effective set, not its components', () => {
    // effective is the union Core already computed (Section 5.6). An app must
    // never re-derive it, so a permission present only in a component field is
    // not held as far as enforcement is concerned.
    const odd: EffectivePermissions = {
      membershipId: 'm1',
      appId: 'a1',
      orgWide: ['members:invite'],
      appScoped: ['leads:read'],
      effective: [],
    };
    assert.equal(hasPermission(odd, 'members:invite'), false);
    assert.equal(hasPermission(odd, 'leads:read'), false);
  });
});

describe('requirePermission', () => {
  it('returns silently when the permission is held', () => {
    assert.doesNotThrow(() => requirePermission(set(['leads:create']), 'leads:create'));
  });

  it('throws PermissionDeniedError naming the missing permission', () => {
    assert.throws(
      () => requirePermission(set([]), 'leads:create'),
      (error: unknown) => {
        assert.ok(error instanceof PermissionDeniedError);
        assert.equal(error.required, 'leads:create');
        assert.match(error.message, /leads:create/);
        return true;
      },
    );
  });

  it('throws on a null permission set rather than passing', () => {
    assert.throws(() => requirePermission(null, 'anything'), PermissionDeniedError);
  });

  it('is distinguishable from a generic Error, so handlers can map it to 403', () => {
    // The API route catches this specifically to answer 403 rather than 500.
    const error = new PermissionDeniedError('x:y');
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'PermissionDeniedError');
  });
});
