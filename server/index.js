// index.js (CommonJS style)
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { typeDefs } = require('./schema');
const async = require('async');

const GITHUB_TOKEN = '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';
const GITHUB_USERNAME = 'joshuazeltser';
const GITHUB_API_URL = 'https://api.github.com/graphql';

// Rate limiting queue with max 2 concurrent operations
const repoDetailsQueue = async.queue(async (task) => {
    return await fetchRepoDetailsInternal(task.owner, task.repoName);
}, 2);

const resolvers = {
    Query: {
        repositories: async () => {
            return await listRepositories();
        },
        repoDetails: async (_, { owner, name }) => {
            return await fetchRepoDetails(owner, name);
        },
    }
};

const startServer = async () => {
    const server = new ApolloServer({
        typeDefs,
        resolvers,
    });

    const { url } = await startStandaloneServer(server, {
        listen: { port: 4000 },
    });

    console.log(`🚀 Server ready at ${url}`);
};

startServer();

const listRepositories = async () => {
    const query = `
        query {
            user(login: "${GITHUB_USERNAME}") {
                repositories(first: 10) {
                    nodes {
                        name
                        diskUsage
                        owner {
                            login
                        }
                    }
                }
            }
        }
    `;

    try {
        const data = await githubGraphQLRequest(query);
        return data.user.repositories.nodes.map(repo => ({
            name: repo.name,
            size: repo.diskUsage ?? 0,
            owner: repo.owner.login,
        }));
    } catch (error) {
        console.error('Error fetching repositories:', error);
        throw new Error('Failed to fetch repositories');
    }
};

async function fetchRepoDetails(owner, repoName) {
    // Use async queue for rate limiting
    return new Promise((resolve, reject) => {
        repoDetailsQueue.push({ owner, repoName }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

async function fetchRepoDetailsInternal(owner, repoName) {
    const query = `
            query GetRepoDetails($owner: String!, $name: String!) {
                repository(owner: $owner, name: $name) {
                    name
                    diskUsage
                    isPrivate
                    owner {
                        login
                    }
                    object(expression: "HEAD:") {
                        ... on Tree {
                            entries {
                                name
                                type
                                extension
                            }
                        }
                    }
                }
            }
        `;

    try {
        const data = await githubGraphQLRequest(query, { owner, name: repoName });
        const repo = data.repository;

        if (!repo) {
            throw new Error(`Repository ${owner}/${repoName} not found`);
        }

        // Find a .yml or .yaml file if available (from root directory)
        const ymlFile = repo.object?.entries?.find(
            (entry) => entry.extension === '.yml' || entry.extension === '.yaml' ||
                entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')
        );

        let ymlContent = '';
        if (ymlFile) {
            try {
                const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${ymlFile.name}`;
                const res = await fetch(rawUrl, {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'User-Agent': 'Apollo-GraphQL-Server'
                    }
                });

                if (res.ok) {
                    ymlContent = await res.text();
                } else {
                    ymlContent = 'Unable to fetch YML file - access denied or file not found';
                }
            } catch (error) {
                console.error('Error fetching YML file:', error);
                ymlContent = 'Unable to fetch YML file';
            }
        } else {
            ymlContent = 'No YML file found in repository root';
        }

        // Get total file count recursively
        // const totalFiles = await getTotalFileCount(owner, repoName);

        // Fetch active webhooks using REST API (GraphQL doesn't expose webhooks)
        let activeWebhooks = [];
        try {
            const webhooksRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/hooks`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'User-Agent': 'Apollo-GraphQL-Server',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (webhooksRes.ok) {
                const webhooks = await webhooksRes.json();
                activeWebhooks = webhooks
                    .filter(hook => hook.active)
                    .map(hook => `${hook.name} - ${hook.config?.url || 'No URL'}`);
            }
        } catch (error) {
            console.error('Error fetching webhooks:', error);
            activeWebhooks = ['Unable to fetch webhook information'];
        }

        return {
            name: repo.name,
            size: repo.diskUsage ?? 0,
            owner: repo.owner.login,
            isPrivate: repo.isPrivate,
            // numberOfFiles: totalFiles,
            ymlContent,
            activeWebhooks
        };
    } catch (error) {
        console.error(`Error fetching details for ${owner}/${repoName}:`, error);
        throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
}

// Recursively count all files in the repository
async function getTotalFileCount(owner, repoName, path = '') {
    const query = `
        query GetTreeContents($owner: String!, $name: String!, $expression: String!) {
            repository(owner: $owner, name: $name) {
                object(expression: $expression) {
                    ... on Tree {
                        entries {
                            name
                            type
                            path
                        }
                    }
                }
            }
        }
    `;

    try {
        const expression = path ? `HEAD:${path}` : 'HEAD:';
        const data = await githubGraphQLRequest(query, {
            owner,
            name: repoName,
            expression
        });

        const entries = data.repository?.object?.entries || [];
        let fileCount = 0;

        // Count files and recursively traverse directories
        for (const entry of entries) {
            if (entry.type === 'blob') {
                // It's a file
                fileCount++;
            } else if (entry.type === 'tree') {
                // It's a directory, recursively count files in it
                const subPath = path ? `${path}/${entry.name}` : entry.name;
                const subCount = await getTotalFileCount(owner, repoName, subPath);
                fileCount += subCount;
            }
        }

        return fileCount;
    } catch (error) {
        console.error(`Error counting files in ${path || 'root'}:`, error);
        // Return 0 if we can't access a directory (permissions, etc.)
        return 0;
    }
}

const githubGraphQLRequest = async (query, variables = {}) => {
    try {
        const res = await fetch(GITHUB_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Apollo-GraphQL-Server'
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data.data;
    } catch (error) {
        console.error('GitHub GraphQL request failed:', error);
        throw error;
    }
};