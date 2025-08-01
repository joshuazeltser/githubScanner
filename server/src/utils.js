const GITHUB_API_URL = 'https://api.github.com/graphql';

const githubGraphQLRequest = async (query, variables = {}, githubToken) => {
    try {
        const res = await fetch(GITHUB_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
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

async function githubRestRequest(url, githubToken) {
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Apollo-GraphQL-Server',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!res.ok) {
            throw new Error(`GitHub REST API request failed with status ${res.status}`);
        }

        const data = await res.json();
        return data;
    } catch (error) {
        console.error('GitHub REST request error:', error);
        throw error;
    }
}

module.exports = {githubGraphQLRequest, githubRestRequest};