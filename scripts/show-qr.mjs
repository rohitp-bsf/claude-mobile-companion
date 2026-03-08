#!/usr/bin/env node
/**
 * npm run qr — Show the QR code for mobile auto-login.
 * Reads token from ~/.claude-companion-token, detects ngrok, prints deep link QR.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TOKEN_FILE = join(homedir(), '.claude-companion-token');
const PORT = process.env.PORT || '3099';

if (!existsSync(TOKEN_FILE)) {
    console.error('No token found. Start the server first: npm run serve');
    process.exit(1);
}

const token = readFileSync(TOKEN_FILE, 'utf-8').trim();

// Detect ngrok
let serverUrl = `http://localhost:${PORT}`;
try {
    const res = await fetch(`http://localhost:4040/api/tunnels`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    const tunnel = data.tunnels?.find(t => t.public_url?.startsWith('https://') && t.config?.addr?.includes(PORT));
    if (tunnel) serverUrl = tunnel.public_url;
} catch {
    // Check LAN
    const { networkInterfaces } = await import('os');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                serverUrl = `http://${net.address}:${PORT}`;
                break;
            }
        }
    }
}

const deepLink = `https://rohitp-bsf.github.io/claude-mobile-companion/?server=${encodeURIComponent(serverUrl)}&pin=${token}`;

console.log('\n  Server:', serverUrl);
console.log('  Token:', token.slice(0, 8) + '...');
console.log('  Deep link:', deepLink);
console.log('');

try {
    const qrcode = require('qrcode-terminal');
    qrcode.generate(deepLink, { small: true }, (qr) => {
        console.log(qr);
        console.log('  Scan with your phone camera to auto-connect.\n');
    });
} catch {
    console.log('  (Install qrcode-terminal for QR display)\n');
}
