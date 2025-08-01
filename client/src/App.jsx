import React, { useState } from 'react';
import RepoList from './components/RepoList';
import RepoDetails from './components/RepoDetails';

export default function App() {
    const [selectedRepo, setSelectedRepo] = useState(null);

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: 20, maxWidth: 900, margin: 'auto' }}>
            <h1>GitHub Repo Explorer</h1>
            {!selectedRepo && <RepoList onSelect={setSelectedRepo} />}
            {selectedRepo && (
                <RepoDetails
                    owner={selectedRepo.owner}
                    name={selectedRepo.name}
                    onBack={() => setSelectedRepo(null)}
                />
            )}
        </div>
    );
}
