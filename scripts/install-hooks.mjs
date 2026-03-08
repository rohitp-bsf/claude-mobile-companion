#!/usr/bin/env node
/**
 * npm run setup:hooks         — Install companion hooks into Claude Code settings
 * npm run setup:hooks:remove  — Remove companion hooks
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');
const HOOK_SCRIPT = resolve(__dirname, '../server/hooks/companion-hook.sh');
const REMOVE = process.argv.includes('--remove');

const HOOK_EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];

if (!existsSync(SETTINGS_FILE)) {
    console.error(`Claude Code settings not found: ${SETTINGS_FILE}`);
    console.error('Make sure Claude Code is installed.');
    process.exit(1);
}

if (!existsSync(HOOK_SCRIPT)) {
    console.error(`Hook script not found: ${HOOK_SCRIPT}`);
    process.exit(1);
}

const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));

if (REMOVE) {
    // Remove companion hooks
    if (!settings.hooks) {
        console.log('No hooks configured. Nothing to remove.');
        process.exit(0);
    }

    let removed = 0;
    for (const event of HOOK_EVENTS) {
        if (settings.hooks[event]) {
            settings.hooks[event] = settings.hooks[event].filter(
                (h) => !h.command?.includes('companion-hook.sh')
            );
            if (settings.hooks[event].length === 0) {
                delete settings.hooks[event];
            }
            removed++;
        }
    }

    if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
    }

    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
    console.log(`Removed companion hooks from ${removed} events.`);
    console.log(`Settings: ${SETTINGS_FILE}`);
    process.exit(0);
}

// Install hooks
if (!settings.hooks) {
    settings.hooks = {};
}

let installed = 0;
let skipped = 0;

for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
        settings.hooks[event] = [];
    }

    // Check if already installed
    const exists = settings.hooks[event].some(
        (h) => h.command?.includes('companion-hook.sh')
    );

    if (exists) {
        skipped++;
        continue;
    }

    settings.hooks[event].push({
        command: HOOK_SCRIPT
    });
    installed++;
}

writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');

console.log('');
console.log('  Claude Mobile Companion — Hooks Setup');
console.log('  ─────────────────────────────────────');
console.log(`  Settings: ${SETTINGS_FILE}`);
console.log(`  Hook script: ${HOOK_SCRIPT}`);
console.log(`  Installed: ${installed} hooks`);
if (skipped > 0) {
    console.log(`  Skipped: ${skipped} (already installed)`);
}
console.log('');
console.log('  Events hooked:');
for (const event of HOOK_EVENTS) {
    console.log(`    - ${event}`);
}
console.log('');
console.log('  All new Claude Code sessions will now appear on your phone.');
console.log('  To remove: npm run setup:hooks:remove');
console.log('');
