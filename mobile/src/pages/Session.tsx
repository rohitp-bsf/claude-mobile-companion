import { useEffect, useRef, useState } from 'react';
import type { SessionInfo } from '../../../shared/src/index';
import type { WSMessage } from '../hooks/useWebSocket';
import StatusBadge from '../components/StatusBadge';
import ApprovalCard from '../components/ApprovalCard';
import MessageBubble from '../components/MessageBubble';

interface Props {
    sessionId: string;
    messages: WSMessage[];
    sessions: SessionInfo[];
    onBack: () => void;
    onApprove: (toolCallId: string) => void;
    onReject: (toolCallId: string, reason?: string) => void;
    onSendMessage: (text: string) => void;
    onAbort: () => void;
}

export default function Session({
    sessionId,
    messages,
    sessions,
    onBack,
    onApprove,
    onReject,
    onSendMessage,
    onAbort,
}: Props) {
    const session = sessions.find((s) => s.id === sessionId);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const isActive = session && (session.status === 'running' || session.status === 'waiting_approval' || session.status === 'waiting_input');

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <header className="shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1 -ml-1 text-slate-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{session?.prompt || 'Session'}</p>
                        <p className="text-xs text-slate-500 truncate">{session?.cwd}</p>
                    </div>
                    <StatusBadge status={session?.status || 'running'} />
                </div>
            </header>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto message-stream px-4 py-4 space-y-3"
            >
                {messages.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        Waiting for Claude output...
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.type === 'approval' && msg.toolCall) {
                        // Check if this is the latest pending approval
                        const isPending = session?.status === 'waiting_approval' &&
                            session.pendingApproval?.id === msg.toolCall.id;

                        return (
                            <ApprovalCard
                                key={i}
                                toolCall={msg.toolCall}
                                isPending={isPending}
                                onApprove={() => onApprove(msg.toolCall!.id)}
                                onReject={(reason) => onReject(msg.toolCall!.id, reason)}
                            />
                        );
                    }

                    return <MessageBubble key={i} message={msg} />;
                })}
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3">
                {isActive ? (
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Send a message..."
                            className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-claude-500"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="px-4 py-2.5 bg-claude-500 hover:bg-claude-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                        >
                            Send
                        </button>
                        <button
                            type="button"
                            onClick={onAbort}
                            className="px-3 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-colors"
                            title="Abort session"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </form>
                ) : (
                    <div className="text-center text-slate-500 text-sm py-1">
                        Session {session?.status || 'ended'}
                    </div>
                )}
            </div>
        </div>
    );
}
