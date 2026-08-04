import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, GitBranch, LogOut, Loader2, Activity, Code, Star, GitFork, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch projects with their repositories
    const { data, error } = await supabase
      .from('projects')
      .select('*, repositories(*)');

    if (error) {
      console.error(error);
      return;
    }
    setProjects(data || []);
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch('http://127.0.0.1:8000/api/repositories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ github_url: url })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to add repository');
      }

      setUrl('');
      fetchProjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  // Colors for language distribution pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Code className="w-8 h-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">RepoTutor</span>
            </div>
            <div className="flex items-center">
              <button onClick={handleSignOut} className="flex items-center text-gray-500 hover:text-gray-700">
                <LogOut className="w-5 h-5 mr-1" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Add Repository Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analyze New Repository</h2>
          <form onSubmit={handleAddRepository} className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <GitBranch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
              Analyze
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Dashboard Analytics Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900">Your Repositories</h2>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by analyzing a GitHub repository.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {projects.map((project) => {
                const repo = project.repositories?.[0];
                const langData = repo?.languages ? Object.entries(repo.languages).map(([name, value]) => ({ name, value })) : [];

                return (
                  <div key={project.id} className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{project.repo_name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{repo?.description || 'No description provided.'}</p>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <div className="flex items-center"><Star className="w-4 h-4 mr-1" /> {repo?.stars || 0}</div>
                        <div className="flex items-center"><GitFork className="w-4 h-4 mr-1" /> {repo?.forks || 0}</div>
                        <div className="flex items-center"><Users className="w-4 h-4 mr-1" /> {repo?.contributors || 0}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Language Distribution Chart */}
                      <div className="h-64 border rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Language Distribution</h4>
                        {langData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={langData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {langData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => [value, 'Bytes']} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-400">No language data</div>
                        )}
                      </div>

                      {/* Fake Commit Frequency Chart (Since Phase 1 GitHub API doesn't easily give full commit history in 1 request) */}
                      <div className="h-64 border rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Commit Frequency (Mocked)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Mon', commits: 12 }, { name: 'Tue', commits: 19 },
                            { name: 'Wed', commits: 15 }, { name: 'Thu', commits: 22 },
                            { name: 'Fri', commits: 8 }, { name: 'Sat', commits: 3 }, { name: 'Sun', commits: 5 }
                          ]}>
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: '#f3f4f6' }} />
                            <Bar dataKey="commits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
