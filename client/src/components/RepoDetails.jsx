import React, { useEffect, useState } from 'react';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

export default function RepoDetails({ owner, name, onBack }) {
    const [repoDetails, setRepoDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchDetails() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(GRAPHQL_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `
              query GetRepoDetails($owner: String!, $name: String!) {
                repoDetails(owner: $owner, name: $name) {
                  name
                  size
                  owner
                  isPrivate
                  numberOfFiles
                  ymlContent
                  activeWebhooks
                }
              }
            `,
                        variables: { owner, name },
                    }),
                });
                const json = await res.json();
                if (json.errors) throw new Error(json.errors[0].message);
                setRepoDetails(json.data.repoDetails);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchDetails();
    }, [owner, name]);

    if (loading) return <p>Loading repository details...</p>;
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
    if (!repoDetails) return null;

    return (
        <div>
            <button onClick={onBack} style={{ marginBottom: 20 }}>
                ← Back to list
            </button>
            <h2>{repoDetails.name}</h2>
            <p>
                <strong>Owner:</strong> {repoDetails.owner}
            </p>
            <p>
                <strong>Private:</strong> {repoDetails.isPrivate ? 'Yes' : 'No'}
            </p>
            <p>
                <strong>Size:</strong> {formatSize(repoDetails.size)}
            </p>
            <p>
                <strong>Total Files:</strong> {repoDetails.numberOfFiles.toLocaleString()}
            </p>

            <h3>Active Webhooks ({repoDetails.activeWebhooks.length}):</h3>
            {repoDetails.activeWebhooks.length === 0 ? (
                <p>No active webhooks.</p>
            ) : (
                <ul>
                    {repoDetails.activeWebhooks.map((wh, idx) => (
                        <li key={idx}>{wh}</li>
                    ))}
                </ul>
            )}

            <h3>YAML File Content {repoDetails.ymlFilePath && `(${repoDetails.ymlFilePath})`}:</h3>
            <pre
                style={{
                    background: '#222',
                    color: '#eee',
                    padding: 10,
                    borderRadius: 4,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflowY: 'auto',
                }}
            >
        {repoDetails.ymlContent || 'No YAML content available'}
      </pre>
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
