import { NextResponse } from 'next/server';
import { isDevAuthAllowed } from '@/lib/session';

/**
 * DEVELOPMENT ONLY. Sets or clears the stand-in session cookie.
 *
 * Returns 404 whenever real auth is available or the build is not development,
 * so this route cannot be used to forge a session in any deployed environment.
 */
export async function POST(request: Request) {
  if (!isDevAuthAllowed()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const target = new URL('/', request.url);
  const response = NextResponse.redirect(target, { status: 303 });

  if (action === 'signin') {
    const clerkUserId = String(form.get('clerkUserId') ?? '').trim();
    if (!clerkUserId) return new NextResponse('clerkUserId required', { status: 400 });
    response.cookies.set('beorchid_dev_user', clerkUserId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,
    });
  } else {
    response.cookies.delete('beorchid_dev_user');
  }

  return response;
}
