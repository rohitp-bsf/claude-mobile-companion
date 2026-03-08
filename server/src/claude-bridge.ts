import { query, type SDKMessage, type Options, type CanUseTool } from '@anthropic-ai/claude-code';
import { EventEmitter } from 'events';
import type { ToolCallInfo, SessionStatus } from '@claude-companion/shared';
import crypto from 'crypto';

export interface ClaudeSession {
    id: string;
    cwd: string;
    prompt: string;
    status: SessionStatus;
    createdAt: number;
    lastActivityAt: number;
    pendingApproval?: ToolCallInfo;
    abortController: AbortController;
    /** Resolve function for pending permission request */
    permissionResolver?: (result: { behavior: 'allow' | 'deny'; message?: string }) => void;
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
            const canUseTool: CanUseTool = async (toolName, input, { signal }) => {
                const toolCallId = crypto.randomUUID();
                const toolCall: ToolCallInfo = {
                    id: toolCallId,
                    name: toolName,
                    input,
                    description: this.summarizeToolCall(toolName, input),
                };

                session.status = 'waiting_approval';
                session.pendingApproval = toolCall;

                this.emit('approval_needed', {
                    sessionId: session.id,
                    toolCall,
                });

                // Wait for mobile user to approve/reject
                const result = await new Promise<{ behavior: 'allow' | 'deny'; message?: string }>((resolve) => {
                    session.permissionResolver = (res) => resolve(res);

                    // Also listen for abort
                    signal.addEventListener('abort', () => {
                        resolve({ behavior: 'deny', message: 'Session aborted' });
                    }, { once: true });
                });

                session.permissionResolver = undefined;
                session.pendingApproval = undefined;
                session.status = 'running';

                if (result.behavior === 'allow') {
                    return { behavior: 'allow', updatedInput: input };
                }
                return { behavior: 'deny', message: result.message || 'Rejected from mobile' };
            };

            const options: Options = {
                cwd: session.cwd,
                abortController: session.abortController,
                canUseTool,
            };

            const stream = query({ prompt: session.prompt, options });

            for await (const message of stream) {
                session.lastActivityAt = Date.now();
                this.processMessage(session, message);
            }

            session.status = 'completed';
            this.emit('complete', { sessionId: session.id });
        } catch (err: unknown) {
            if ((session.status as string) === 'aborted') return;

            const errMessage = err instanceof Error ? err.message : String(err);
            session.status = 'error';
            this.emit('error', { sessionId: session.id, error: errMessage });
        }
    }

    /** Resolve a pending permission request */
    resolvePermission(session: ClaudeSession, approved: boolean, reason?: string): void {
        if (session.permissionResolver) {
            session.permissionResolver(
                approved
                    ? { behavior: 'allow' }
                    : { behavior: 'deny', message: reason || 'Rejected from mobile' },
            );
        }
    }

    private processMessage(session: ClaudeSession, message: SDKMessage): void {
        switch (message.type) {
            case 'assistant': {
                const content = this.extractAssistantText(message);
                if (content) {
                    this.emit('output', {
                        sessionId: session.id,
                        content,
                    });
                }
                break;
            }

            case 'result': {
                if ('result' in message && message.result) {
                    this.emit('output', {
                        sessionId: session.id,
                        content: message.result,
                    });
                }
                break;
            }

            case 'system': {
                if (message.subtype === 'init') {
                    this.emit('output', {
                        sessionId: session.id,
                        content: `[System] Session initialized — model: ${message.model}, tools: ${message.tools.length}`,
                    });
                }
                break;
            }
        }
    }

    private extractAssistantText(message: SDKMessage): string {
        if (message.type !== 'assistant') return '';
        const assistantMsg = message.message;
        if (!assistantMsg || !assistantMsg.content) return '';

        if (typeof assistantMsg.content === 'string') return assistantMsg.content;

        return assistantMsg.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('');
    }

    private summarizeToolCall(name: string, input: Record<string, unknown>): string {
        switch (name) {
            case 'Read':
                return `Read file: ${input.file_path || 'unknown'}`;
            case 'Write':
                return `Write file: ${input.file_path || 'unknown'}`;
            case 'Edit':
                return `Edit file: ${input.file_path || 'unknown'}`;
            case 'Bash':
                return `Run command: ${String(input.command || '').slice(0, 100)}`;
            case 'Glob':
                return `Search files: ${input.pattern || 'unknown'}`;
            case 'Grep':
                return `Search content: ${input.pattern || 'unknown'}`;
            default:
                return `Tool: ${name}`;
        }
    }
}
