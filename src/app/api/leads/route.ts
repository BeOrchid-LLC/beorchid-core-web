import { NextResponse } from 'next/server';
import { PermissionDeniedError, requirePermission } from '@beorchid/core-sdk';
import { currentContext } from '@/lib/core';
import { createLead } from '@/lib/db';

/**
 * Write path, gated on `leads:create` (Section 6.3).
 *
 * The order matters: authenticate, resolve, enforce, and only then touch the
 * database. Every one of those steps can deny, and none is skippable by a
 * caller who goes straight to this route rather than through the page.
 */
export async function POST(request: Request) {
  const result = await currentContext();
  if (result.state === 'signed-out') return new NextResponse('Unauthorized', { status: 401 });
  if (result.state === 'unlinked') {
    // A valid Clerk session with no Core identity holds no permissions, so this
    // is a denial rather than an authentication failure.
    return NextResponse.json({ error: 'account not yet linked to Core' }, { status: 403 });
  }
  const context = result.context;

  try {
    requirePermission(context.permissions, 'leads:create');
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json({ error: error.message, required: error.required }, { status: 403 });
    }
    throw error;
  }

  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const orgId = context.organization?.id;
  if (!orgId) return NextResponse.json({ error: 'no organization in context' }, { status: 400 });

  await createLead(orgId, context.user.id, name);
  return NextResponse.redirect(new URL('/leads', request.url), { status: 303 });
}
