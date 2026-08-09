import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { ParseStatus, CodeStats, CommitWeek } from '../lib/api';
import {
  Plus, GitBranch, LogOut, Loader2, Activity, Code2, Star, GitFork,
  Users, Cpu, FolderTree, Zap, Box, FileCode2, RefreshCw,
  CheckCircle2, AlertCircle, GitCommit, Terminal, Eye, Trash2, Search, BarChart2, Bot, Network, BookOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import StructureView from './StructureView';

// ── Language colors (muted, tasteful palette) ────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  Python: '#3b82f6',
  JavaScript: '#f59e0b',
  TypeScript: '#6366f1',
  Java: '#ef4444',
  Go: '#10b981',
  Rust: '#f97316',
  Ruby: '#e11d48',
  C: '#8b5cf6',
  'C++': '#a855f7',
  'C#': '#06b6d4',
  HTML: '#fb923c',
  CSS: '#0ea5e9',
  Shell: '#84cc16',
};

function getLangColor(lang: string, idx: number): string {
  return LANG_COLORS[lang] || ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4'][idx % 6];
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  none:      { label: 'Not parsed',           color: '#a3a3a3', bg: '#f5f5f5' },
  pending:   { label: 'Queued',               color: '#f59e0b', bg: '#fffbeb' },
  cloning:   { label: 'Cloning repository…',  color: '#3b82f6', bg: '#eff6ff' },
  parsing:   { label: 'Parsing source files…',color: '#7c3aed', bg: '#f5f3ff' },
  storing:   { label: 'Saving to database…',  color: '#7c3aed', bg: '#f5f3ff' },
  completed: { label: 'Analysis complete',    color: '#059669', bg: '#ecfdf5' },
  failed:    { label: 'Failed',               color: '#dc2626', bg: '#fef2f2' },
  cancelled: { label: 'Cancelled',            color: '#a3a3a3', bg: '#f5f5f5' },
};

// ── Parse Progress ────────────────────────────────────────────────────────────

function ParseProgressBar({ status }: { status: ParseStatus }) {
  const isActive = ['pending', 'cloning', 'parsing', 'storing'].includes(status.status);
  const cfg = STATUS_CONFIG[status.status] || STATUS_CONFIG.none;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isActive && <Loader2 size={13} style={{ color: cfg.color, animation: 'spin 1s linear infinite' }} />}
          {status.status === 'completed' && <CheckCircle2 size={13} style={{ color: cfg.color }} />}
          {status.status === 'failed' && <AlertCircle size={13} style={{ color: cfg.color }} />}
          <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: 11, color: '#a3a3a3', fontVariantNumeric: 'tabular-nums' }}>{status.progress}%</span>
      </div>

      <div style={{ height: 3, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${status.progress}%`,
            background: status.status === 'completed' ? '#059669' : status.status === 'failed' ? '#dc2626' : '#7c3aed',
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {status.current_step && (
        <p style={{ fontSize: 11, color: '#a3a3a3', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status.current_step}
        </p>
      )}
      {status.status === 'failed' && status.error_message && (
        <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6, padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>
          {status.error_message}
        </p>
      )}
    </div>
  );
}

// ── Code Stats ────────────────────────────────────────────────────────────────

function CodeStatsCard({ stats }: { stats: CodeStats }) {
  const items = [
    { icon: FileCode2, label: 'Files',     value: stats.total_files.toLocaleString(),     color: '#3b82f6' },
    { icon: Box,       label: 'Classes',   value: stats.total_classes.toLocaleString(),   color: '#7c3aed' },
    { icon: Zap,       label: 'Functions', value: stats.total_functions.toLocaleString(), color: '#059669' },
    { icon: Terminal,  label: 'Lines',     value: stats.total_lines.toLocaleString(),     color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
      {items.map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          style={{
            background: '#fafafa',
            border: '1px solid #eeeeee',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <Icon size={14} style={{ color }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#111111', lineHeight: 1 }}>{value}</p>
          <p style={{ fontSize: 11, color: '#a3a3a3' }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CommitTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}>
      <p style={{ color: '#6b6b6b', marginBottom: 2 }}>{payload[0].payload.label}</p>
      <p style={{ fontWeight: 600, color: '#111111' }}>{payload[0].value} commits</p>
    </div>
  );
}

function LangTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const kb = Math.round(payload[0].value / 1024);
  return (
    <div style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}>
      <p style={{ fontWeight: 600, color: '#111111', marginBottom: 2 }}>{payload[0].name}</p>
      <p style={{ color: '#6b6b6b' }}>{kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}</p>
    </div>
  );
}

// ── Repo Card ─────────────────────────────────────────────────────────────────

function RepoCard({
  project,
  onViewStructure,
  onDelete,
}: {
  project: any;
  onViewStructure: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const repo = project.repositories?.[0];
  const projectId = project.id;

  const [parseStatus, setParseStatus] = useState<ParseStatus>({ status: 'none', progress: 0, current_step: null });
  const [stats, setStats] = useState<CodeStats | null>(null);
  const [commitData, setCommitData] = useState<{ name: string; commits: number; label: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatCommitData = useCallback((weeks: CommitWeek[]) => {
    return weeks.map((w) => {
      const date = new Date(w.week * 1000);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { name: label, commits: w.total, label };
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const status = await api.getParseStatus(projectId);
        setParseStatus(status);
        if (status.status === 'completed') loadStats();
        if (['pending', 'cloning', 'parsing', 'storing'].includes(status.status)) startPolling();
      } catch { /* ignore */ }

      try {
        const ca = await api.getCommitActivity(projectId);
        if (ca.commit_activity?.length > 0) setCommitData(formatCommitData(ca.commit_activity));
      } catch {
        if (repo?.commit_activity?.length > 0) setCommitData(formatCommitData(repo.commit_activity));
      }
    };

    init();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [projectId]);

  const loadStats = async () => {
    setLoadingStats(true);
    try { const s = await api.getCodeStats(projectId); setStats(s); } catch { /* ignore */ }
    finally { setLoadingStats(false); }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await api.getParseStatus(projectId);
        setParseStatus(status);
        if (status.status === 'completed') {
          clearInterval(pollingRef.current!); pollingRef.current = null; loadStats();
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          clearInterval(pollingRef.current!); pollingRef.current = null;
          setCancelling(false);
        }
      } catch { /* ignore */ }
    }, 2500);
  };

  const handleParse = async () => {
    setParsing(true);
    try {
      await api.triggerParse(projectId);
      const status = await api.getParseStatus(projectId);
      setParseStatus(status);
      startPolling();
    } catch (e: any) { alert(`Failed to start parsing: ${e.message}`); }
    finally { setParsing(false); }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelParse(projectId);
      // Immediately update local state; polling will confirm
      setParseStatus(prev => ({ ...prev, status: 'cancelled', current_step: 'Cancellation requested…' }));
    } catch (e: any) {
      alert(`Failed to cancel: ${e.message}`);
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${project.repo_name}" from your dashboard?`)) return;
    setDeleting(true);
    try { await api.deleteProject(projectId); onDelete(); }
    catch (e: any) { alert(`Failed to delete: ${e.message}`); }
    finally { setDeleting(false); }
  };

  const langData = repo?.languages
    ? Object.entries(repo.languages as Record<string, number>)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([name, value], i) => ({ name, value: value as number, fill: getLangColor(name, i) }))
    : [];

  const isActiveJob = ['pending', 'cloning', 'parsing', 'storing'].includes(parseStatus.status);
  const isParsed = parseStatus.status === 'completed';

  const [owner, repoName] = project.repo_name.split('/');

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e5e5e5',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#d4d4d4';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e5e5';
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <GitBranch size={15} style={{ color: '#a3a3a3', flexShrink: 0 }} />
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: 13, color: '#6b6b6b', fontWeight: 400 }}>{owner}/</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#111111' }}>{repoName}</span>
            </div>
          </div>
          {repo?.description && (
            <p style={{ fontSize: 13, color: '#6b6b6b', marginLeft: 23, lineHeight: 1.5 }}>{repo.description}</p>
          )}
          {repo?.topics && repo.topics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 23 }}>
              {(repo.topics as string[]).slice(0, 5).map(t => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 500,
                  padding: '2px 8px',
                  background: '#f4f4f5',
                  color: '#6b6b6b',
                  borderRadius: 99,
                  border: '1px solid #e4e4e7',
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Stats + Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16, flexShrink: 0 }}>
          <StatBadge icon={Star} value={repo?.stars ?? 0} />
          <StatBadge icon={GitFork} value={repo?.forks ?? 0} />
          <StatBadge icon={Users} value={repo?.contributors ?? 0} />
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Remove from dashboard"
            style={{
              padding: '4px 6px', border: 'none', background: 'transparent',
              color: '#d4d4d4', cursor: 'pointer', borderRadius: 6, display: 'flex',
              alignItems: 'center', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d4'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: isParsed && stats ? 0 : 0 }}>
        {/* Language Distribution */}
        <ChartPanel title="Language Distribution" icon={Code2}>
          {langData.length > 0 ? (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={langData} cx="40%" cy="50%" innerRadius={44} outerRadius={66} paddingAngle={3} dataKey="value">
                    {langData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<LangTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
                {langData.slice(0, 4).map(l => (
                  <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#6b6b6b' }}>{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart label="No language data" />
          )}
        </ChartPanel>

        {/* Commit Frequency */}
        <ChartPanel title="Commit Frequency (12 wks)" icon={GitCommit}>
          {commitData.length > 0 ? (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commitData} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#a3a3a3' }} interval={2} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#a3a3a3' }} width={28} />
                  <Tooltip content={<CommitTooltip />} cursor={{ fill: 'rgba(124,58,237,0.06)' }} />
                  <Bar dataKey="commits" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No commit data yet" sub="GitHub computes this async — try re-analyzing" />
          )}
        </ChartPanel>
      </div>

      {/* Code Stats (post-parse) */}
      {isParsed && !loadingStats && stats && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel icon={Cpu} text="Code Structure" />
          <CodeStatsCard stats={stats} />
        </div>
      )}

      {/* Progress bar */}
      {parseStatus.status !== 'none' && <ParseProgressBar status={parseStatus} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f5f5f5' }}>
        <button
          onClick={handleParse}
          disabled={parsing || isActiveJob}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: isParsed ? 'white' : '#111111',
            color: isParsed ? '#6b6b6b' : 'white',
            border: isParsed ? '1px solid #e5e5e5' : '1px solid #111111',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: (parsing || isActiveJob) ? 'not-allowed' : 'pointer',
            opacity: (parsing || isActiveJob) ? 0.6 : 1,
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          {parsing || isActiveJob
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : isParsed ? <RefreshCw size={13} /> : <Cpu size={13} />}
          {isParsed ? 'Re-Parse' : isActiveJob ? 'Parsing…' : 'Parse Repository'}
        </button>

        {/* Cancel button — only while job is active */}
        {isActiveJob && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'white',
              color: cancelling ? '#a3a3a3' : '#dc2626',
              border: `1px solid ${cancelling ? '#e5e5e5' : '#fecaca'}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: cancelling ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!cancelling) (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
          >
            {cancelling
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Cancelling…</>
              : <><span style={{ fontSize: 14, lineHeight: 1 }}>×</span> Cancel Parsing</>
            }
          </button>
        )}

        <button
          onClick={() => navigate(`/projects/${projectId}/analytics`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'white', color: '#3b82f6',
            border: '1px solid #dbeafe', borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
        >
          <BarChart2 size={13} /> Analytics
        </button>

        <button
          onClick={() => navigate(`/projects/${projectId}/chat`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: '#f5f3ff', color: '#7c3aed',
            border: '1px solid #ede9fe', borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ede9fe'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff'; }}
        >
          <Bot size={13} /> Ask AI Tutor
        </button>

        <button
          onClick={() => navigate(`/projects/${projectId}/architecture`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'white', color: '#059669',
            border: '1px solid #a7f3d0', borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ecfdf5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
        >
          <Network size={13} /> Architecture
        </button>

        <button
          onClick={() => navigate(`/projects/${projectId}/reports`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'white', color: '#d97706',
            border: '1px solid #fde68a', borderRadius: 8,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fffbeb'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
        >
          <BookOpen size={13} /> Reports
        </button>

        {isParsed && (
          <button
            onClick={onViewStructure}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: 'white', color: '#7c3aed',
              border: '1px solid #ede9fe', borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
          >
            <Eye size={13} /> View Structure
          </button>
        )}
      </div>
    </div>
  );
}

function StatBadge({ icon: Icon, value }: { icon: any; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon size={13} style={{ color: '#a3a3a3' }} />
      <span style={{ fontSize: 12, color: '#6b6b6b', fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function ChartPanel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fafafa', border: '1px solid #eeeeee', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon size={12} style={{ color: '#a3a3a3' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <p style={{ fontSize: 12, color: '#d4d4d4' }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#e5e5e5', textAlign: 'center' }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      <Icon size={12} style={{ color: '#a3a3a3' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{text}</span>
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

      const response = await fetch('http://localhost:8000/api/repositories/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ github_url: url }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errMsg = 'Failed to add repository';
        if (errData.error?.message) errMsg = errData.error.message;
        else if (errData.detail) errMsg = errData.detail;
        throw new Error(errMsg);
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
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e5e5',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#111111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Code2 size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111111', letterSpacing: '-0.01em' }}>RepoTutor</span>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', background: 'transparent',
              color: '#6b6b6b', border: '1px solid #e5e5e5',
              borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d4d4'; (e.currentTarget as HTMLButtonElement).style.color = '#111'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e5e5'; (e.currentTarget as HTMLButtonElement).style.color = '#6b6b6b'; }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px' }}>

        {/* Add Repository */}
        <div style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111111', marginBottom: 4 }}>Analyze a Repository</h2>
          <p style={{ fontSize: 13, color: '#a3a3a3', marginBottom: 16 }}>Paste any public GitHub URL to fetch metadata and parse the source code.</p>

          <form onSubmit={handleAddRepository} style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3', pointerEvents: 'none' }} />
              <input
                type="url"
                required
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                style={{
                  width: '100%', padding: '9px 12px 9px 36px',
                  background: '#fafafa', border: '1px solid #e5e5e5',
                  borderRadius: 10, fontSize: 13, color: '#111111',
                  outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e5e5'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px',
                background: '#111111', color: 'white',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'background 0.15s', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#3f3f46'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#111111'; }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
              Analyze
            </button>
          </form>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
            </div>
          )}
        </div>

        {/* Repository List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#6b6b6b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderTree size={14} /> Your Repositories
            </h2>
            {projects.length > 0 && (
              <span style={{ fontSize: 12, color: '#a3a3a3' }}>{projects.length} repo{projects.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {projects.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '64px 24px',
              background: 'white', border: '1px dashed #e5e5e5',
              borderRadius: 16,
            }}>
              <div style={{ width: 44, height: 44, background: '#f4f4f5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Activity size={20} style={{ color: '#a3a3a3' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#6b6b6b', marginBottom: 6 }}>No repositories yet</p>
              <p style={{ fontSize: 13, color: '#a3a3a3' }}>Paste a GitHub URL above to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projects.map(project => (
                <RepoCard
                  key={project.id}
                  project={project}
                  onViewStructure={() => setStructureTarget({ id: project.id, name: project.repo_name })}
                  onDelete={fetchProjects}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
