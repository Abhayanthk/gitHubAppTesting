import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const installation_id = searchParams.get('installation_id');

  if (!installation_id) {
    return NextResponse.json({ error: 'Missing installation_id' }, { status: 400 });
  }

  // Set the installation ID in a cookie and redirect to the home page
  const response = NextResponse.redirect(new URL('/', request.url));
  
  response.cookies.set({
    name: 'github_installation_id',
    value: installation_id,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  return response;
}
