// schema.js
const typeDefs = `#graphql
type Repo {
    name: String!
    size: Int!
    owner: String!
}

type RepoDetails {
    name: String!
    size: Int!
    owner: String!
    isPrivate: Boolean!
    numberOfFiles: Int!
    ymlContent: String!
    activeWebhooks: [String!]!
}

type Query {
    repositories: [Repo!]!
    repoDetails(owner: String!, name: String!): RepoDetails
}
`;

module.exports = { typeDefs };