import type { WSMessage } from '../hooks/useWebSocket';

interface Props {
    message: WSMessage;
}

export default function MessageBubble({ message }: Props) {
    const time = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (message.type === 'complete') {
        return (
            <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-green-500/20" />
                <span className="text-xs text-green-400">Session completed</span>
                <div className="flex-1 h-px bg-green-500/20" />
            </div>
        );
    }

    if (message.type === 'error') {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-sm text-red-400">{message.content}</p>
                <p className="text-xs text-red-500/60 mt-1">{time}</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 rounded-xl p-3">
            <div className="text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
            </div>
            <p className="text-xs text-slate-500 mt-2">{time}</p>
        </div>
    );
}
