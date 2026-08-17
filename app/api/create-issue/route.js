import { getInstallationAccessToken } from '../../../lib/github-auth';
import { cookies } from 'next/headers';

// Creates an issue on the repo the App is installed on.
// Expects JSON body: { title: string, body: string, owner: string, repo: string }
export async function POST(request) {
  const cookieStore = await cookies();
  const installationId = cookieStore.get('github_installation_id')?.value;
  
  if (!installationId) {
    return Response.json({ error: 'Missing installation_id cookie' }, { status: 400 });
  }

  const { title, body, owner, repo } = await request.json();

  if (!owner || !repo) {
    return Response.json({ error: 'Missing owner or repo in request body' }, { status: 400 });
  }

  const token = await getInstallationAccessToken(installationId);

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body }),
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}
