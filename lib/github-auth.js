import fs from 'fs';
import jwt from 'jsonwebtoken';

// GitHub App auth is a two-step handshake:
//
//   1. Sign a short-lived JWT with the App's private key. This JWT proves
//      "I am App <GITHUB_APP_ID>" -- it's the App's own identity, not tied
//      to any specific repo yet.
//   2. Exchange that JWT for an "installation access token" scoped to one
//      specific installation (i.e. one repo/org the App is installed on).
//      This is the token you actually use to call the GitHub REST API.
//
// Installation access tokens expire after 1 hour, so in a real app you'd
// cache and refresh this. For this learning project we just fetch a fresh
// one on every request.
export async function getInstallationAccessToken(installationId) {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

  if (!appId || !installationId || !privateKeyPath) {
    throw new Error(
      'Missing GITHUB_APP_ID, installationId, or GITHUB_APP_PRIVATE_KEY_PATH'
    );
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // --- Step 1: build and sign the App JWT ---
  //
  // GitHub only requires three claims in the payload:
  const now = Math.floor(Date.now() / 1000); // JWT times are in seconds, not ms
  const jwtPayload = {
    iat: now - 60, // "issued at" -- backdated 60s to tolerate clock drift between this machine and GitHub's servers
    exp: now + 60 * 9, // "expires at" -- GitHub rejects App JWTs with a lifetime over 10 minutes, so 9 is a safe margin
    iss: appId, // "issuer" -- the App ID, tells GitHub which App is making the claim
  };

  // GitHub Apps use RSA key pairs (not a shared secret), so the JWT must be
  // signed with RS256 using the private key you downloaded from the App's settings page.
  const appJwt = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

  // --- Step 2: exchange the App JWT for an installation access token ---
  //
  // The App JWT alone can only hit a handful of "app-level" endpoints (like this one).
  // This call says "using my App identity, give me a token for installation X",
  // where X is the specific repo/org this App is installed on.
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`, // note: Bearer + JWT here, NOT the installation token
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to get installation access token: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  return data.token; // installation access token -- use this as the Bearer token for all REST calls below
}
