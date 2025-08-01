import React, { useEffect, useState } from 'react';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

export default function RepoList({ onSelect }) {
    const [repositories, setRepositories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchRepositories() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(GRAPHQL_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `
              query {
                repositories {
                  name
                  size
                  owner
                }
              }
            `,
                    }),
                });
                const json = await res.json();
                if (json.errors) throw new Error(json.errors[0].message);
                setRepositories(json.data.repositories);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchRepositories();
    }, []);

    if (loading) return <p>Loading repositories...</p>;
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

    if (repositories.length === 0) return <p>No repositories found.</p>;

    return (
        <div>
            <h2>Repositories</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {repositories.map((repo) => (
                    <li
                        key={`${repo.owner}/${repo.name}`}
                        onClick={() => onSelect(repo)}
                        style={{
                            padding: '10px',
                            borderBottom: '1px solid #ccc',
                            cursor: 'pointer',
                        }}
                    >
                        <strong>{repo.name}</strong> by {repo.owner} — size: {formatSize(repo.size)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function formatSize(size) {
    if (size === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return (size / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}
