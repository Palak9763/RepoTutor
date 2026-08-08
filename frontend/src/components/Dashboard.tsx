import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { ParseStatus, CodeStats, CommitWeek } from '../lib/api';
import {
  Plus, GitBranch, LogOut, Loader2, Activity, Code2, Star, GitFork,
  Users, Cpu, FolderTree, Zap, Box, FileCode2, RefreshCw,
  CheckCircle2, AlertCircle, GitCommit, Terminal, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import StructureView from './StructureView';

// ── Colors ───────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  Python: '#3b82f6',
  JavaScript: '#f59e0b',
  TypeScript: '#6366f1',
  Java: '#ef4444',
  Go: '#00add8',
  Rust: '#f97316',
  Ruby: '#dc2626',
  C: '#8b5cf6',
  'C++': '#a855f7',
  'C#': '#22c55e',
  HTML: '#f97316',
  CSS: '#06b6d4',
  Shell: '#84cc16',
};

function getLangColor(lang: string, idx: number): string {
  return (
    LANG_COLORS[lang] ||
    ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4'][idx % 6]
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  none: 'Not parsed',
  pending: 'Queued...',
  cloning: 'Cloning repository...',
  parsing: 'Parsing source files...',
  storing: 'Saving to database...',
  completed: 'Parse complete!',
  failed: 'Parse failed',
};

function ParseProgressBar({ status, projectId }: { status: ParseStatus; projectId: string }) {
  const isActive = ['pending', 'cloning', 'parsing', 'storing'].includes(status.status);
  const isDone = status.status === 'completed';
  const isFailed = status.status === 'failed';

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive && <Loader2 size={14} className="text-indigo-400 animate-spin" />}
          {isDone && <CheckCircle2 size={14} className="text-emerald-400" />}
          {isFailed && <AlertCircle size={14} className="text-red-400" />}
          <span className={`text-xs font-medium ${isDone ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-indigo-300'}`}>
            {STATUS_LABELS[status.status]}
          </span>
        </div>
        <span className="text-xs text-slate-500">{status.progress}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isDone ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${status.progress}%` }}
        />
      </div>
      {status.current_step && (
        <p className="text-xs text-slate-500 mt-1.5 truncate">{status.current_step}</p>
      )}
      {isFailed && status.error_message && (
        <p className="text-xs text-red-400/80 mt-1.5 bg-red-900/20 rounded px-2 py-1">
          {status.error_message}
        </p>
      )}
    </div>
  );
}

// ── Code Stats Card ───────────────────────────────────────────────────────────

function CodeStatsCard({ stats }: { stats: CodeStats }) {
  const items = [
    { icon: FileCode2, label: 'Files', value: stats.total_files.toLocaleString(), color: 'text-blue-400' },
    { icon: Box, label: 'Classes', value: stats.total_classes.toLocaleString(), color: 'text-purple-400' },
    { icon: Zap, label: 'Functions', value: stats.total_functions.toLocaleString(), color: 'text-indigo-400' },
    { icon: Terminal, label: 'Lines', value: stats.total_lines.toLocaleString(), color: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-1">
          <Icon size={16} className={color} />
          <p className={`text-lg font-bold ${color}`}>{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CommitTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-0.5">{d.payload.label}</p>
      <p className="text-indigo-300 font-bold">{d.value} commits</p>
    </div>
  );
}

function LangTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const kb = Math.round(d.value / 1024);
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white mb-0.5">{d.name}</p>
      <p className="text-slate-400">{kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}</p>
    </div>
  );
}

// ── Repo Card ─────────────────────────────────────────────────────────────────

function RepoCard({
  project,
  onViewStructure,
}: {
  project: any;
  onViewStructure: () => void;
}) {
  const repo = project.repositories?.[0];
  const projectId = project.id;

  const [parseStatus, setParseStatus] = useState<ParseStatus>({ status: 'none', progress: 0, current_step: null });
  const [stats, setStats] = useState<CodeStats | null>(null);
  const [commitData, setCommitData] = useState<{ name: string; commits: number; label: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Format commit activity data for chart
  const formatCommitData = useCallback((weeks: CommitWeek[]) => {
    return weeks.map((w) => {
      const date = new Date(w.week * 1000);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { name: label, commits: w.total, label };
    });
  }, []);

  // Load parse status and stats on mount
  useEffect(() => {
    const init = async () => {
      try {
        const status = await api.getParseStatus(projectId);
        setParseStatus(status);

        // If already parsed, load stats
        if (status.status === 'completed') {
          loadStats();
        }

        // If running, start polling
        if (['pending', 'cloning', 'parsing', 'storing'].includes(status.status)) {
          startPolling();
        }
      } catch {
        // ignore
      }

      // Load commit activity
      try {
        const ca = await api.getCommitActivity(projectId);
        if (ca.commit_activity?.length > 0) {
          setCommitData(formatCommitData(ca.commit_activity));
        }
      } catch {
        // use stored data from repo
        if (repo?.commit_activity?.length > 0) {
          setCommitData(formatCommitData(repo.commit_activity));
        }
      }
    };

    init();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [projectId]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const s = await api.getCodeStats(projectId);
      setStats(s);
    } catch {
      // ignore
    } finally {
      setLoadingStats(false);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await api.getParseStatus(projectId);
        setParseStatus(status);
        if (status.status === 'completed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          loadStats();
        } else if (status.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);
  };

  const handleParse = async () => {
    setParsing(true);
    try {
      await api.triggerParse(projectId);
      const status = await api.getParseStatus(projectId);
      setParseStatus(status);
      startPolling();
    } catch (e: any) {
      alert(`Failed to start parsing: ${e.message}`);
    } finally {
      setParsing(false);
    }
  };

  const langData = repo?.languages
    ? Object.entries(repo.languages as Record<string, number>)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([name, value], i) => ({ name, value: value as number, fill: getLangColor(name, i) }))
    : [];

  const isActiveJob = ['pending', 'cloning', 'parsing', 'storing'].includes(parseStatus.status);
  const isParsed = parseStatus.status === 'completed';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/60 p-6 shadow-xl">
      {/* Card header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={16} className="text-indigo-400 flex-shrink-0" />
            <h3 className="text-xl font-bold text-white truncate">{project.repo_name}</h3>
          </div>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            {repo?.description || 'No description provided.'}
          </p>
          {repo?.topics && repo.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(repo.topics as string[]).slice(0, 5).map(t => (
                <span key={t} className="px-2 py-0.5 bg-indigo-600/20 text-indigo-300 text-xs rounded-full border border-indigo-500/20">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-amber-400" />
            <span className="text-white font-medium">{(repo?.stars || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitFork size={14} className="text-blue-400" />
            <span className="text-white font-medium">{(repo?.forks || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-emerald-400" />
            <span className="text-white font-medium">{(repo?.contributors || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Language Distribution */}
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Code2 size={12} /> Language Distribution
          </h4>
          {langData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={langData}
                    cx="40%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {langData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<LangTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-slate-300">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-slate-600">
              No language data
            </div>
          )}
        </div>

        {/* Commit Frequency */}
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <GitCommit size={12} /> Commit Frequency (12 weeks)
          </h4>
          {commitData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commitData} barCategoryGap="30%">
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    interval={2}
                  />
                  <YAxis
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b' }}
                    width={28}
                  />
                  <Tooltip content={<CommitTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                  <Bar dataKey="commits" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-slate-600">
              <GitCommit size={24} className="opacity-40" />
              <span>No commit data yet</span>
              <span className="text-xs text-slate-700">(GitHub computes this async — try re-analyzing)</span>
            </div>
          )}
        </div>
      </div>

      {/* Code Structure Summary */}
      {isParsed && stats && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Cpu size={12} /> Code Structure
          </h4>
          {loadingStats ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-3">
              <Loader2 size={14} className="animate-spin" /> Loading stats...
            </div>
          ) : (
            <CodeStatsCard stats={stats} />
          )}
        </div>
      )}

      {/* Parse Job Progress */}
      {parseStatus.status !== 'none' && (
        <ParseProgressBar status={parseStatus} projectId={projectId} />
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-700/40">
        <button
          onClick={handleParse}
          disabled={parsing || isActiveJob}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
            isParsed
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {parsing || isActiveJob ? (
            <Loader2 size={15} className="animate-spin" />
          ) : isParsed ? (
            <RefreshCw size={15} />
          ) : (
            <Cpu size={15} />
          )}
          {isParsed ? 'Re-Parse' : isActiveJob ? 'Parsing...' : 'Parse Repository'}
        </button>

        {isParsed && (
          <button
            onClick={onViewStructure}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600/50 transition-all duration-200"
          >
            <Eye size={15} />
            View Structure
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [structureTarget, setStructureTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*, repositories(*)')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    setProjects(data || []);
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('http://127.0.0.1:8000/api/repositories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ github_url: url }),
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

  // Show structure view if selected
  if (structureTarget) {
    return (
      <StructureView
        projectId={structureTarget.id}
        projectName={structureTarget.name}
        onBack={() => setStructureTarget(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Nav */}
      <nav className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Code2 size={16} className="text-white" />
              </div>
              <div>
                <span className="text-white font-bold tracking-tight">CodeAtlas</span>
                <span className="text-indigo-400 font-bold tracking-tight"> AI</span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Add Repository */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl border border-slate-700/60 p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Analyze New Repository</h2>
          <p className="text-sm text-slate-400 mb-5">Enter a public GitHub URL to fetch metadata and start code analysis.</p>
          <form onSubmit={handleAddRepository} className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <GitBranch size={16} className="text-slate-500" />
              </div>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="block w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Analyze
            </button>
          </form>
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Repository List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FolderTree size={20} className="text-indigo-400" />
              Your Repositories
            </h2>
            {projects.length > 0 && (
              <span className="text-sm text-slate-500">{projects.length} repo{projects.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-dashed border-slate-700">
              <Activity className="mx-auto h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-slate-300 font-medium">No repositories yet</h3>
              <p className="mt-1 text-sm text-slate-500">Paste a GitHub URL above to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {projects.map((project) => (
                <RepoCard
                  key={project.id}
                  project={project}
                  onViewStructure={() => setStructureTarget({ id: project.id, name: project.repo_name })}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
