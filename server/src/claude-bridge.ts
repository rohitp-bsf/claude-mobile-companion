import { claude, type ClaudeCodeEvent } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'events';
import type { ToolCallInfo, SessionStatus } from '@claude-companion/shared';

export interface ClaudeSession {
    id: string;
    cwd: string;
    prompt: string;
    status: SessionStatus;
    createdAt: number;
    lastActivityAt: number;
    pendingApproval?: ToolCallInfo;
    abortController: AbortController;
}

export class ClaudeBridge extends EventEmitter {
    /**
     * Start a new Claude Code session.
     * Events emitted:
     *   'output'           - { sessionId, content }
     *   'approval_needed'  - { sessionId, toolCall }
     *   'complete'         - { sessionId }
     *   'error'            - { sessionId, error }
     */
    async run(session: ClaudeSession): Promise<void> {
        session.status = 'running';
        session.lastActivityAt = Date.now();

        try {
            const stream = claude(session.prompt, {
                cwd: session.cwd,
                abortController: session.abortController,
                // Start in plan mode — user approves from mobile
                options: {
                    allowedTools: [],
                },
            });

            for await (const event of stream as AsyncIterable<ClaudeCodeEvent>) {
                session.lastActivityAt = Date.now();
                this.processEvent(session, event);
            }

            session.status = 'completed';
            this.emit('complete', { sessionId: session.id });
        } catch (err: unknown) {
            if (session.status === 'aborted') return;

            const message = err instanceof Error ? err.message : String(err);
            session.status = 'error';
            this.emit('error', { sessionId: session.id, error: message });
        }
    }

    private processEvent(session: ClaudeSession, event: ClaudeCodeEvent): void {
        switch (event.type) {
            case 'assistant': {
                const content = this.extractTextContent(event);
                if (content) {
                    this.emit('output', {
                        sessionId: session.id,
                        content,
                    });
                }
                break;
            }

            case 'tool_use': {
                const toolCall: ToolCallInfo = {
                    id: (event as any).id || crypto.randomUUID(),
                    name: (event as any).name || 'unknown',
                    input: (event as any).input || {},
                    description: this.summarizeToolCall(event),
                };

                session.status = 'waiting_approval';
                session.pendingApproval = toolCall;

                this.emit('approval_needed', {
                    sessionId: session.id,
                    toolCall,
                });
                break;
            }

            case 'result': {
                // Final result from the session
                const resultContent = this.extractTextContent(event);
                if (resultContent) {
                    this.emit('output', {
                        sessionId: session.id,
                        content: resultContent,
                    });
                }
                break;
            }
        }
    }

    private extractTextContent(event: ClaudeCodeEvent): string {
        if ('content' in event && typeof event.content === 'string') {
            return event.content;
        }
        if ('content' in event && Array.isArray(event.content)) {
            return event.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
        }
        // Handle message events
        if ('message' in event && typeof (event as any).message === 'string') {
            return (event as any).message;
        }
        return '';
    }

    private summarizeToolCall(event: ClaudeCodeEvent): string {
        const name = (event as any).name || '';
        const input = (event as any).input || {};

        switch (name) {
            case 'Read':
                return `Read file: ${input.file_path || 'unknown'}`;
            case 'Write':
                return `Write file: ${input.file_path || 'unknown'}`;
            case 'Edit':
                return `Edit file: ${input.file_path || 'unknown'}`;
            case 'Bash':
                return `Run command: ${(input.command || '').slice(0, 100)}`;
            case 'Glob':
                return `Search files: ${input.pattern || 'unknown'}`;
            case 'Grep':
                return `Search content: ${input.pattern || 'unknown'}`;
            default:
                return `Tool: ${name}`;
        }
    }
}
