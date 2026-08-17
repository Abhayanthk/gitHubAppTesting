'use client';

import { useState, useEffect } from 'react';

const preStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: '#f5f5f5',
  padding: 12,
  borderRadius: 4,
};

// Turns a raw GitHub API response into a short, readable summary line.
// Returns null if the shape isn't recognized, so we just fall back to raw JSON.
function summarize(key, data) {
  if (typeof data !== 'object' || data === null) return null;

  if (data.message && !data.number && !Array.isArray(data)) {
    return `Error: ${data.message}`; // GitHub API error responses look like { message, documentation_url }
  }

  if (key === 'repoFiles' && Array.isArray(data)) {
    return data.map((file) => `[${file.type}] ${file.name}`).join('\n');
  }

  if (key === 'createIssue' && data.number) {
    return `Issue #${data.number} created: "${data.title}"\n${data.html_url}`;
  }

  if (key === 'openPr' && data.number) {
    return `PR #${data.number} opened: "${data.title}"\n${data.html_url}`;
  }

  return null;
}

export default function Home() {
  // One key per endpoint, holding whatever JSON came back (or an error string).
  const [results, setResults] = useState({});
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);

  useEffect(() => {
    async function fetchRepos() {
      try {
        const response = await fetch('/api/user-repos');
        const data = await response.json();
        if (data.repositories) {
          setRepos(data.repositories);
          if (data.repositories.length > 0) {
            setSelectedRepo(data.repositories[0].full_name);
          }
        }
      } catch (error) {
        console.error('Failed to fetch repos', error);
      } finally {
        setIsLoadingRepos(false);
      }
    }
    fetchRepos();
  }, []);

  async function callEndpoint(key, url, options) {
    setResults((prev) => ({ ...prev, [key]: 'Loading...' }));
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      setResults((prev) => ({ ...prev, [key]: data }));
    } catch (error) {
      setResults((prev) => ({ ...prev, [key]: `Request failed: ${error.message}` }));
    }
  }

  function renderResult(key) {
    const data = results[key];
    if (data === undefined) return null;

    if (typeof data === 'string') {
      return <pre style={preStyle}>{data}</pre>;
    }

    const summary = summarize(key, data);
    return (
      <>
        {summary && <pre style={preStyle}>{summary}</pre>}
        <details style={{ marginTop: 8 }}>
          <summary>Raw JSON</summary>
          <pre style={preStyle}>{JSON.stringify(data, null, 2)}</pre>
        </details>
      </>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', maxWidth: 800, margin: '0 auto' }}>
      <h1>GitHub App Auth Test</h1>
      <p>Each button hits an API route, which authenticates as the GitHub App and calls the GitHub REST API.</p>

      <section style={{ marginTop: 24 }}>
        <h2>1. Connect GitHub</h2>
        <p>Install the app to see your repositories (like Vercel does).</p>
        <a
          href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'YOUR_APP_SLUG'}/installations/new`}
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            background: '#24292e',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            marginTop: '8px'
          }}
        >
          Connect GitHub
        </a>
      </section>

      {isLoadingRepos ? (
        <p style={{ marginTop: 24 }}>Loading repositories...</p>
      ) : repos.length > 0 ? (
        <div style={{ marginTop: 32, padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
          <h2>Select Repository</h2>
          <select 
            value={selectedRepo} 
            onChange={(e) => setSelectedRepo(e.target.value)}
            style={{ padding: 8, fontSize: 16, width: '100%', marginBottom: 16 }}
          >
            {repos.map(repo => (
              <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
            ))}
          </select>

          <section style={{ marginTop: 24 }}>
            <h2>List repo files</h2>
            <button onClick={() => {
              const [owner, repo] = selectedRepo.split('/');
              callEndpoint('repoFiles', `/api/repo-files?owner=${owner}&repo=${repo}`);
            }}>
              GET /api/repo-files
            </button>
            {renderResult('repoFiles')}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>Create test issue</h2>
            <button
              onClick={() => {
                const [owner, repo] = selectedRepo.split('/');
                callEndpoint('createIssue', '/api/create-issue', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: 'Test issue from GitHub App',
                    body: 'Created via the GitHub App installation token.',
                    owner,
                    repo
                  }),
                });
              }}
            >
              POST /api/create-issue
            </button>
            {renderResult('createIssue')}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>Open test PR</h2>
            <button onClick={() => {
              const [owner, repo] = selectedRepo.split('/');
              callEndpoint('openPr', '/api/open-pr', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo })
              });
            }}>
              POST /api/open-pr
            </button>
            {renderResult('openPr')}
          </section>
        </div>
      ) : (
        <p style={{ marginTop: 24 }}>No repositories found. Please connect GitHub and grant access to at least one repository.</p>
      )}
    </main>
  );
}
