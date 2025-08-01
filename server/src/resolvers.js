const {listRepositories, fetchRepoDetails} = require("./githubClient");

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

module.exports = { resolvers };