import { watch, readFileSync, existsSync, statSync } from 'fs';
import { EventEmitter } from 'events';

interface TranscriptEntry {
    type: string;
    message?: {
        role?: string;
        content?: Array<{ type: string; text?: string; name?: string }> | string;
    };
    // user messages
    isSynthetic?: boolean;
}

/**
 * Watches a Claude Code transcript JSONL file and emits new assistant text messages.
 * Emits: 'text' (sessionId, content), 'tool_start' (sessionId, toolName)
 */
export class TranscriptWatcher extends EventEmitter {
    private watchers = new Map<string, { close: () => void; offset: number }>();

    /** Start watching a transcript file for a CLI session */
    watch(sessionId: string, transcriptPath: string): void {
        if (this.watchers.has(sessionId)) return;
        if (!transcriptPath || !existsSync(transcriptPath)) return;

        // Start from current end of file (only emit NEW content)
        const stats = statSync(transcriptPath);
        let offset = stats.size;
        let buffer = '';

        const processNewLines = () => {
            try {
                const content = readFileSync(transcriptPath, 'utf-8');
                const newContent = content.slice(offset);
                offset = content.length;

                if (!newContent) return;

                buffer += newContent;
                const lines = buffer.split('\n');
                // Keep incomplete last line in buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    try {
                        const entry: TranscriptEntry = JSON.parse(trimmed);
                        this.processEntry(sessionId, entry);
                    } catch {
                        // Skip malformed lines
                    }
                }
            } catch {
                // File may have been deleted/rotated
            }
        };

        const watcher = watch(transcriptPath, () => {
            processNewLines();
        });

        // Also poll every 2s as fallback (fs.watch can miss events)
        const interval = setInterval(processNewLines, 2000);

        this.watchers.set(sessionId, {
            close: () => {
                watcher.close();
                clearInterval(interval);
            },
            offset,
        });
    }

    /** Stop watching a session's transcript */
    unwatch(sessionId: string): void {
        const w = this.watchers.get(sessionId);
        if (w) {
            w.close();
            this.watchers.delete(sessionId);
        }
    }

    /** Stop all watchers */
    unwatchAll(): void {
        for (const [id] of this.watchers) {
            this.unwatch(id);
        }
    }

    private processEntry(sessionId: string, entry: TranscriptEntry): void {
        if (entry.type === 'assistant' && entry.message?.content) {
            const content = entry.message.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === 'text' && block.text) {
                        this.emit('text', { sessionId, content: block.text });
                    }
                    if (block.type === 'tool_use' && block.name) {
                        this.emit('tool_start', { sessionId, toolName: block.name });
                    }
                }
            } else if (typeof content === 'string' && content) {
                this.emit('text', { sessionId, content });
            }
        }
    }
}
