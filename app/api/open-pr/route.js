import { getInstallationAccessToken } from '../../../lib/github-auth';
import { cookies } from 'next/headers';

// Creates a branch, commits a small test file to it, and opens a PR against
// the default branch. This walks through the raw Git-data API calls that a
// higher-level SDK would normally hide.
export async function POST(request) {
  const cookieStore = await cookies();
  const installationId = cookieStore.get('github_installation_id')?.value;
  
  if (!installationId) {
    return Response.json({ error: 'Missing installation_id cookie' }, { status: 400 });
  }

  const { owner, repo } = await request.json();

  if (!owner || !repo) {
    return Response.json({ error: 'Missing owner or repo in request body' }, { status: 400 });
  }

  const token = await getInstallationAccessToken(installationId);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Look up the repo's default branch (e.g. "main") -- that's what we'll branch from and PR into.
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch;

  // 2. Get the commit SHA the default branch currently points to. A new branch is just
  //    a new named pointer ("ref") at an existing commit, so we need this SHA to create one.
  const refResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
    { headers }
  );
  const refData = await refResponse.json();
  const baseSha = refData.object.sha;

  // 3. Create the new branch by creating a new ref pointing at that same commit.
  const branchName = `test-pr-${Date.now()}`;
  await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });

  // 4. Commit a small change on the new branch. The "contents" API creates a commit for us
  //    in one call, so we don't have to manually create blob/tree/commit objects.
  const fileContent = `Test file created by GitHub App at ${new Date().toISOString()}\n`;
  await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/test-file.txt`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: 'Add test file via GitHub App',
      content: Buffer.from(fileContent).toString('base64'), // the contents API requires base64-encoded file content
      branch: branchName,
    }),
  });

  // 5. Open the pull request from the new branch into the default branch.
  const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Test PR from GitHub App',
      head: branchName,
      base: defaultBranch,
      body: 'This PR was created automatically to test GitHub App authentication.',
    }),
  });
  const prData = await prResponse.json();

  return Response.json(prData, { status: prResponse.status });
}
