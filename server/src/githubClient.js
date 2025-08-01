const {githubRestRequest, githubGraphQLRequest} = require("./utils");
const {queue} = require("async/index");

const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MAX_CONCURRENT_FETCH_DETAILS = 2
const MAX_LIST_REPOS = 100

const listRepositories = async () => {
    const query = `
        query {
            user(login: "${GITHUB_USERNAME}") {
                repositories(first: ${MAX_LIST_REPOS}) {
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
        const data = await githubGraphQLRequest(query, {}, GITHUB_TOKEN);
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


// Rate limiting queue with max 2 concurrent operations
const repoDetailsQueue = queue(async (task) => {
    return await fetchRepoDetailsInternal(task.owner, task.repoName);
}, MAX_CONCURRENT_FETCH_DETAILS);

const fetchRepoDetails = (owner, repoName) => {
    // Use async queue for rate limiting
    return new Promise((resolve, reject) => {
        repoDetailsQueue.push({ owner, repoName }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

const fetchRepoDetailsInternal = async (owner, repoName) => {
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
        const data = await githubGraphQLRequest(query, { owner, name: repoName }, GITHUB_TOKEN);
        const repo = data.repository;

        if (!repo) {
            throw new Error(`Repository ${owner}/${repoName} not found`);
        }

        // Run all secondary fetches in parallel
        const [ymlContentResult, totalFilesResult, activeWebhooksResult] = await Promise.all([
            getOneYamlFile(owner, repoName).catch(error => {
                console.info('Error fetching YML file:', error);
                return 'Unable to fetch YML file';
            }),
            getTotalFileCountWithREST(owner, repoName).catch(error => {
                console.error('Error fetching file count:', error);
                return 0;
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/hooks`, {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'User-Agent': 'Apollo-GraphQL-Server',
                    'Accept': 'application/vnd.github.v3+json'
                }
            })
                .then(res => res.ok ? res.json() : [])
                .then(webhooks =>
                    (webhooks || [])
                        .filter(hook => hook.active)
                        .map(hook => `${hook.name} - ${hook.config?.url || 'No URL'}`)
                )
                .catch(error => {
                    console.error('Error fetching webhooks:', error);
                    return ['Unable to fetch webhook information'];
                })
        ]);

        return {
            name: repo.name,
            size: repo.diskUsage ?? 0,
            owner: repo.owner.login,
            isPrivate: repo.isPrivate,
            numberOfFiles: totalFilesResult,
            ymlContent: ymlContentResult,
            activeWebhooks: activeWebhooksResult
        };
    } catch (error) {
        console.error(`Error fetching details for ${owner}/${repoName}:`, error);
        throw new Error(`Failed to fetch repository details: ${error.message}`);
    }
}


const getOneYamlFile = async (owner, repoName) => {
    const treeUrl = `https://api.github.com/repos/${owner}/${repoName}/git/trees/HEAD?recursive=1`;

    try {

        const data = await githubRestRequest(treeUrl, GITHUB_TOKEN)
        const tree = data.tree || [];

        // Find first YAML file
        const yamlFile = tree.find(entry =>
            entry.type === 'blob' &&
            (entry.path.endsWith('.yml') || entry.path.endsWith('.yaml'))
        );

        if (!yamlFile) {
            return 'No YAML file found in repository'

        }

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
        return await contentRes.text();
    } catch (error) {
        console.error('Error retrieving YAML file:', error);
        return {
            path: null,
            content: 'Error fetching YAML file'
        };
    }
}

const getTotalFileCountWithREST= async (owner, repoName) => {
    const url = `https://api.github.com/repos/${owner}/${repoName}/git/trees/HEAD?recursive=1`;

    try {
        const data = await githubRestRequest(url, GITHUB_TOKEN)
        if (!data.tree) return 0;

        return data.tree.filter(entry => entry.type === 'blob').length;
    } catch (error) {
        console.error('Error fetching total file count (REST):', error);
        return 0;
    }
}

module.exports = {listRepositories, fetchRepoDetails}