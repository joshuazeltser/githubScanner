import React, { useState, useEffect } from 'react';
import { Search, GitBranch, Lock, Unlock, FileText, Webhook, RefreshCw, AlertCircle, ChevronLeft } from 'lucide-react';

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

const GitHubClient = () => {
    const [repositories, setRepositories] = useState([]);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [repoDetails, setRepoDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch repositories list
    const fetchRepositories = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

            const data = await response.json();

            if (data.errors) {
                throw new Error(data.errors[0].message);
            }

            setRepositories(data.data.repositories || []);
        } catch (err) {
            setError(`Failed to fetch repositories: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch repository details
    const fetchRepoDetails = async (owner, name) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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

            const data = await response.json();

            if (data.errors) {
                throw new Error(data.errors[0].message);
            }

            setRepoDetails(data.data.repoDetails);
        } catch (err) {
            setError(`Failed to fetch repository details: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle repository selection
    const handleRepoSelect = (repo) => {
        setSelectedRepo(repo);
        fetchRepoDetails(repo.owner, repo.name);
    };

    // Handle back to list
    const handleBackToList = () => {
        setSelectedRepo(null);
        setRepoDetails(null);
        setError(null);
    };

    // Filter repositories based on search term
    const filteredRepositories = repositories.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.owner.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Format file size
    const formatSize = (size) => {
        if (size === 0) return '0 KB';
        const k = 1024;
        const sizes = ['KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Load repositories on component mount
    useEffect(() => {
        fetchRepositories();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                        <GitBranch className="text-blue-400" />
                        GitHub Repository Explorer
                    </h1>
                    <p className="text-gray-300">Browse and explore repository details</p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-900/50 border border-red-500 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="text-red-400 flex-shrink-0" />
                        <span className="text-red-200">{error}</span>
                    </div>
                )}

                {/* Repository List View */}
                {!selectedRepo && (
                    <div className="space-y-6">
                        {/* Search Bar */}
                        <div className="relative max-w-md mx-auto">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search repositories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Refresh Button */}
                        <div className="flex justify-center">
                            <button
                                onClick={fetchRepositories}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200"
                            >
                                <RefreshCw className={`${loading ? 'animate-spin' : ''}`} size={20} />
                                {loading ? 'Loading...' : 'Refresh Repositories'}
                            </button>
                        </div>

                        {/* Repository Grid */}
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredRepositories.map((repo) => (
                                <div
                                    key={`${repo.owner}/${repo.name}`}
                                    onClick={() => handleRepoSelect(repo)}
                                    className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-6 cursor-pointer hover:bg-gray-700/50 hover:border-blue-500 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <h3 className="text-xl font-semibold text-white truncate">{repo.name}</h3>
                                        <GitBranch className="text-blue-400 flex-shrink-0" size={20} />
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <span className="font-medium">Owner:</span>
                                            <span className="text-blue-400">{repo.owner}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-300">
                                            <span className="font-medium">Size:</span>
                                            <span>{formatSize(repo.size)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-right">
                    <span className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                      View Details →
                    </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredRepositories.length === 0 && !loading && (
                            <div className="text-center py-12">
                                <GitBranch className="mx-auto text-gray-500 mb-4" size={48} />
                                <p className="text-gray-400 text-lg">
                                    {searchTerm ? 'No repositories match your search.' : 'No repositories found.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Repository Details View */}
                {selectedRepo && (
                    <div className="space-y-6">
                        {/* Back Button */}
                        <button
                            onClick={handleBackToList}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
                        >
                            <ChevronLeft size={20} />
                            Back to Repositories
                        </button>

                        {/* Repository Header */}
                        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                    <GitBranch className="text-blue-400" />
                                    {selectedRepo.name}
                                </h2>
                                {repoDetails && (
                                    repoDetails.isPrivate ?
                                        <Lock className="text-red-400" size={24} /> :
                                        <Unlock className="text-green-400" size={24} />
                                )}
                            </div>

                            <div className="text-gray-300">
                                <span className="font-medium">Owner:</span>{' '}
                                <span className="text-blue-400">{selectedRepo.owner}</span>
                            </div>
                        </div>

                        {/* Loading State for Details */}
                        {loading && (
                            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-8 text-center">
                                <RefreshCw className="animate-spin mx-auto mb-4 text-blue-400" size={32} />
                                <p className="text-gray-300">Loading repository details...</p>
                            </div>
                        )}

                        {/* Repository Details */}
                        {repoDetails && !loading && (
                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Basic Information */}
                                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                        <FileText className="text-green-400" />
                                        Repository Information
                                    </h3>

                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Visibility:</span>
                                            <div className="flex items-center gap-2">
                                                {repoDetails.isPrivate ? (
                                                    <>
                                                        <Lock className="text-red-400" size={16} />
                                                        <span className="text-red-400">Private</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Unlock className="text-green-400" size={16} />
                                                        <span className="text-green-400">Public</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Size:</span>
                                            <span className="text-white">{formatSize(repoDetails.size)}</span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-gray-400">Total Files:</span>
                                            <span className="text-white">{repoDetails.numberOfFiles.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Webhooks */}
                                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                        <Webhook className="text-purple-400" />
                                        Active Webhooks ({repoDetails.activeWebhooks.length})
                                    </h3>

                                    <div className="space-y-2">
                                        {repoDetails.activeWebhooks.length > 0 ? (
                                            repoDetails.activeWebhooks.map((webhook, index) => (
                                                <div key={index} className="bg-gray-700/50 rounded p-3">
                                                    <span className="text-gray-300 text-sm">{webhook}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-400 italic">No active webhooks</p>
                                        )}
                                    </div>
                                </div>

                                {/* YAML Content */}
                                <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                                        <FileText className="text-yellow-400" />
                                        YAML File Content
                                    </h3>

                                    <div className="bg-gray-900/80 rounded-lg p-4 border border-gray-700">
                    <pre className="text-gray-300 text-sm overflow-x-auto whitespace-pre-wrap">
                      {repoDetails.ymlContent || 'No YAML content available'}
                    </pre>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GitHubClient;