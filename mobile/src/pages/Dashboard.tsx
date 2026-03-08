import { useState } from 'react';
import type { SessionInfo } from '../../../shared/src/index';
import StatusBadge from '../components/StatusBadge';

interface Props {
    sessions: SessionInfo[];
    onSelectSession: (id: string) => void;
    onNewSession: (cwd: string, prompt: string) => void;
}

export default function Dashboard({ sessions, onSelectSession, onNewSession }: Props) {
    const [showNew, setShowNew] = useState(false);
    const [cwd, setCwd] = useState('');
    const [prompt, setPrompt] = useState('');

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (cwd && prompt) {
            onNewSession(cwd, prompt);
            setShowNew(false);
            setCwd('');
            setPrompt('');
        }
    };

    const activeSessions = sessions.filter((s) => s.status === 'running' || s.status === 'waiting_approval' || s.status === 'waiting_input');
    const pastSessions = sessions.filter((s) => s.status === 'completed' || s.status === 'error' || s.status === 'aborted');

    return (
        <div className="min-h-screen pb-24">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Claude Companion</h1>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-xs text-slate-400">Connected</span>
                    </div>
                </div>
            </header>

            <div className="p-4 space-y-6">
                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                    <section>
                        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Active Sessions</h2>
                        <div className="space-y-2">
                            {activeSessions.map((session) => (
                                <SessionCard key={session.id} session={session} onClick={() => onSelectSession(session.id)} />
                            ))}
                        </div>
                    </section>
                )}

                {/* No active sessions */}
                {activeSessions.length === 0 && !showNew && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="text-slate-400">No active sessions</p>
                        <p className="text-slate-500 text-sm mt-1">Start a new Claude session below</p>
                    </div>
                )}

                {/* New Session Form */}
                {showNew ? (
                    <form onSubmit={handleCreate} className="bg-slate-800 rounded-xl p-4 space-y-3">
                        <h3 className="font-medium">New Session</h3>
                        <input
                            value={cwd}
                            onChange={(e) => setCwd(e.target.value)}
                            placeholder="Working directory (e.g. /Users/you/project)"
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-claude-500"
                        />
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="What should Claude do?"
                            rows={3}
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-claude-500 resize-none"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                className="flex-1 py-2.5 bg-slate-700 rounded-lg text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!cwd || !prompt}
                                className="flex-1 py-2.5 bg-claude-500 hover:bg-claude-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                            >
                                Start
                            </button>
                        </div>
                    </form>
                ) : null}

                {/* Past Sessions */}
                {pastSessions.length > 0 && (
                    <section>
                        <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Recent</h2>
                        <div className="space-y-2">
                            {pastSessions.map((session) => (
                                <SessionCard key={session.id} session={session} onClick={() => onSelectSession(session.id)} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* FAB */}
            {!showNew && (
                <button
                    onClick={() => setShowNew(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-claude-500 hover:bg-claude-600 rounded-full shadow-lg shadow-claude-500/25 flex items-center justify-center transition-colors"
                >
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            )}
        </div>
    );
}

function SessionCard({ session, onClick }: { session: SessionInfo; onClick: () => void }) {
    const timeAgo = formatTimeAgo(session.lastActivityAt);

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-slate-800 hover:bg-slate-750 rounded-xl p-4 transition-colors"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session.prompt}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{session.cwd}</p>
                </div>
                <StatusBadge status={session.status} />
            </div>
            {session.pendingApproval && (
                <div className="mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs text-amber-400">
                        Waiting: {session.pendingApproval.description || session.pendingApproval.name}
                    </p>
                </div>
            )}
            <p className="text-xs text-slate-500 mt-2">{timeAgo}</p>
        </button>
    );
}

function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
