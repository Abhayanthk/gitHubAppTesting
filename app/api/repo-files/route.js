import { getInstallationAccessToken } from '../../../lib/github-auth';
import { cookies } from 'next/headers';

// Lists the files in the root of the repo the App is installed on.
export async function GET(request) {
  const cookieStore = await cookies();
  const installationId = cookieStore.get('github_installation_id')?.value;
  
  if (!installationId) {
    return Response.json({ error: 'Missing installation_id cookie' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return Response.json({ error: 'Missing owner or repo query parameters' }, { status: 400 });
  }

  const token = await getInstallationAccessToken(installationId);

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`, {
    headers: {
      Authorization: `Bearer ${token}`, // this is the installation token from step 2, not the App JWT
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
