import { useState } from 'react';

interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    description?: string;
}

interface Props {
    toolCall: ToolCall;
    isPending: boolean;
    onApprove: () => void;
    onReject: (reason?: string) => void;
}

export default function ApprovalCard({ toolCall, isPending, onApprove, onReject }: Props) {
    const [expanded, setExpanded] = useState(false);

    const toolIcon = getToolIcon(toolCall.name);

    return (
        <div className={`rounded-xl border ${isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800/50 opacity-60'}`}>
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{toolIcon}</span>
                    <span className="text-sm font-medium">{toolCall.name}</span>
                    {isPending && (
                        <span className="ml-auto text-xs text-amber-400 animate-pulse">Waiting</span>
                    )}
                </div>

                <p className="text-sm text-slate-300">
                    {toolCall.description || `Tool: ${toolCall.name}`}
                </p>

                {/* Expandable input details */}
                {Object.keys(toolCall.input).length > 0 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-2 text-xs text-slate-400 hover:text-slate-300"
                    >
                        {expanded ? 'Hide details' : 'Show details'}
                    </button>
                )}

                {expanded && (
                    <pre className="mt-2 p-2 bg-slate-900 rounded-lg text-xs text-slate-400 overflow-x-auto max-h-40 overflow-y-auto">
                        {JSON.stringify(toolCall.input, null, 2)}
                    </pre>
                )}
            </div>

            {/* Action buttons — only for pending approvals */}
            {isPending && (
                <div className="flex border-t border-amber-500/20">
                    <button
                        onClick={() => onReject()}
                        className="flex-1 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-bl-xl transition-colors"
                    >
                        Reject
                    </button>
                    <div className="w-px bg-amber-500/20" />
                    <button
                        onClick={onApprove}
                        className="flex-1 py-2.5 text-sm text-green-400 hover:bg-green-500/10 rounded-br-xl font-medium transition-colors"
                    >
                        Approve
                    </button>
                </div>
            )}
        </div>
    );
}

function getToolIcon(name: string): string {
    switch (name) {
        case 'Read': return '\u{1F4C4}';
        case 'Write': return '\u{270F}\u{FE0F}';
        case 'Edit': return '\u{1F527}';
        case 'Bash': return '\u{1F4BB}';
        case 'Glob': return '\u{1F50D}';
        case 'Grep': return '\u{1F50E}';
        case 'Agent': return '\u{1F916}';
        default: return '\u{2699}\u{FE0F}';
    }
}
