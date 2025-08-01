# 🕵️ GitHub Scanner

A full-stack application that displays GitHub repositories and provides detailed metadata per repository, including size, visibility, file count, YAML file contents, and active webhooks.

Built with:

- **Node.js + Apollo Server (GraphQL)**
- **React (Vite)**
- **GitHub GraphQL & REST APIs**

---

## ⚙️ Requirements

- Node.js v18+
- A GitHub Personal Access Token (PAT) with:
    - `repo`
    - `admin:repo_hook`
- Your GitHub username

---

## 📦 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/github-scanner.git
cd github-scanner
```

### 2. Configure the backend

Create a `.env` file in the `server` directory:

```
GITHUB_TOKEN=your_personal_access_token
GITHUB_USERNAME=your_github_username
```

---

## 🚀 Running the Application

### Start the backend (GraphQL API)

```bash
cd server
npm install
node index.js
```

The GraphQL server will be running at:

```
http://localhost:4000
```

You can access the GraphQL Playground there for testing queries.

---

### Start the frontend (React client)

In a separate terminal window:

```bash
cd client
npm install
npm run dev
```

Visit the app in your browser:

```
http://localhost:3000
```

Ensure the backend is running first so the client can query data.

---

## 📋 Features

- 🔍 List all repositories of a GitHub user
- 📁 View:
    - Repository name, size, visibility
    - Total number of files
    - YAML file content (first one found)
    - Active webhooks

---

## 🔧 Example GraphQL Queries

**List Repositories**

```graphql
query {
  repositories {
    name
    size
    owner
  }
}
```

**Get Repository Details**

```graphql
query {
  repoDetails(owner: "your-username", name: "repo-name") {
    name
    isPrivate
    numberOfFiles
    ymlContent
    activeWebhooks
  }
}
```

---

## 📂 Project Structure

```
github-scanner/
├── client/        # React frontend
│   └── src/
├── server/        # Node.js GraphQL API
│   ├── index.js
│   └── schema.js
├── README.md
```


