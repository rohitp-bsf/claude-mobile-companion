import type { SessionStatus } from '../../../shared/src/index';

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
    running: {
        label: 'Running',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    waiting_approval: {
        label: 'Approval',
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse',
    },
    waiting_input: {
        label: 'Input',
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    completed: {
        label: 'Done',
        className: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    error: {
        label: 'Error',
        className: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    aborted: {
        label: 'Aborted',
        className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
};

export default function StatusBadge({ status }: { status: SessionStatus }) {
    const config = statusConfig[status] || statusConfig.running;

    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${config.className}`}>
            {config.label}
        </span>
    );
}
