import { Router } from 'express';
import type { Request, Response } from 'express';
import { CliSessionTracker } from './cli-session-tracker.js';
import { AuthManager } from './auth.js';

interface HookEventBody {
    session_id: string;
    transcript_path?: string;
    cwd?: string;
    hook_event_name: string;
    tool_name?: string;
    tool_input?: unknown;
    tool_response?: unknown;
    stop_hook_active?: boolean;
    message?: string;
    title?: string;
    source?: string;
}

export function createHookRouter(tracker: CliSessionTracker, auth: AuthManager): Router {
    const router = Router();

    router.post('/event', async (req: Request, res: Response) => {
        // PIN auth
        const pin = req.headers['x-pin'] as string;
        if (!pin || !auth.validate(pin)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const body = req.body as HookEventBody;
        if (!body || !body.hook_event_name) {
            res.status(400).json({ error: 'Missing hook_event_name' });
            return;
        }

        const sessionId = body.session_id || 'unknown';
        const cwd = body.cwd || '';
        const transcriptPath = body.transcript_path || '';

        try {
            switch (body.hook_event_name) {
                case 'SessionStart': {
                    tracker.registerSession(sessionId, cwd, transcriptPath);
                    res.json({});
                    break;
                }

                case 'PreToolUse': {
                    const result = await tracker.handlePreToolUse(
                        sessionId,
                        body.tool_name || 'unknown',
                        body.tool_input,
                    );
                    res.json(result);
                    break;
                }

                case 'PostToolUse': {
                    tracker.handlePostToolUse(
                        sessionId,
                        body.tool_name || 'unknown',
                        body.tool_input,
                        body.tool_response,
                    );
                    res.json({});
                    break;
                }

                case 'Stop': {
                    const result = await tracker.handleStop(sessionId);
                    res.json(result);
                    break;
                }

                case 'Notification': {
                    tracker.handleNotification(sessionId, body.message || '', body.title);
                    res.json({});
                    break;
                }

                default: {
                    res.json({});
                }
            }
        } catch (err) {
            console.error(`Hook error (${body.hook_event_name}):`, err);
            res.json({});
        }
    });

    return router;
}
