import { getInstallationAccessToken } from '../../../lib/github-auth';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const installationId = cookieStore.get('github_installation_id')?.value;

  if (!installationId) {
    return Response.json({ repositories: [] });
  }

  try {
    const token = await getInstallationAccessToken(installationId);

    const response = await fetch('https://api.github.com/installation/repositories', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
       const err = await response.text();
       throw new Error(`Failed to fetch repos: ${response.status} ${err}`);
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
