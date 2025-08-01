const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { typeDefs } = require('./schema');
const async = require('async');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
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
                repositories(first: 100) {
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

    let ymlContent;
    try {
        const data = await githubGraphQLRequest(query, {owner, name: repoName});
        const repo = data.repository;

        if (!repo) {
            throw new Error(`Repository ${owner}/${repoName} not found`);
        }

        // Find any YAML file in the entire repository using search
        try {
            ymlContent = await getOneYamlFile(owner, repoName)
        } catch (error) {
            console.info('Error fetching YML file:', error);
            ymlContent = 'Unable to fetch YML file';
        }


        // Get total file count using search
        const totalFiles = await getTotalFileCountWithREST(owner, repoName);

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
            numberOfFiles: totalFiles,
            ymlContent,
            activeWebhooks
        };
    } catch (error) {
        console.error(`Error fetching details for ${owner}/${repoName}:`, error);
        throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
}

async function getOneYamlFile(owner, repoName) {
    const treeUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees/HEAD?recursive=1`;

    try {
        const res = await fetch(treeUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'Apollo-GraphQL-Server',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch repo tree: ${res.status}`);
        }

        const data = await res.json();
        const tree = data.tree || [];

        // Find first YAML file
        const yamlFile = tree.find(entry =>
            entry.type === 'blob' &&
            (entry.path.endsWith('.yml') || entry.path.endsWith('.yaml'))
        );

        if (!yamlFile) {
            return 'No YAML file found in repository'

        }

        // Fetch raw content
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/HEAD/${yamlFile.path}`;

        const contentRes = await fetch(rawUrl, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'Apollo-GraphQL-Server'
            }
        });

        if (!contentRes.ok) {
            return {
                path: yamlFile.path,
                content: `Unable to fetch YML file - status ${contentRes.status}`
            };
        }

        const content = await contentRes.text();

        return content;
    } catch (error) {
        console.error('Error retrieving YAML file:', error);
        return {
            path: null,
            content: 'Error fetching YAML file'
        };
    }
}



async function getTotalFileCountWithREST(owner, repoName) {
    const url = `https://api.github.com/repos/${owner}/${repoName}/git/trees/HEAD?recursive=1`;

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'Apollo-GraphQL-Server',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch file tree: ${res.status}`);
        }

        const data = await res.json();
        if (!data.tree) return 0;

        const fileCount = data.tree.filter(entry => entry.type === 'blob').length;
        return fileCount;
    } catch (error) {
        console.error('Error fetching total file count (REST):', error);
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